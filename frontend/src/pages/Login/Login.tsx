import ButtonPrimary from "../../components/ButtonPrimary/ButtonPrimary.tsx";
import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {User} from "../../components/types/user";

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [badLogin, setBadLogin] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if(localStorage.getItem("token")) {
            navigate("/");
        }
    })

    async function handleSubmit() {
        const req: LoginRequest = {username: username, password: password};
        const url: string = import.meta.env.VITE_BASE_URL + '/api/auth/login';
        const headers = new Headers({'Content-Type': 'application/json'});
        const res: Response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(req),
            headers: headers
        });

        if(res.ok) {
            const loginResponse: LoginResponse = await res.json();
            localStorage.setItem("token", loginResponse.token);
            localStorage.setItem("username", loginResponse.user.username);
            navigate("/");
        } else {
            setBadLogin(true);
            setUsername('');
            setPassword('');
        }
    }

    return (
        <div className='flex items-center justify-center bg-gradient-to-r from-slate-800 to-slate-600  h-screen w-screen'>
            <div className='flex flex-col h-[300px] w-[450px] bg-white rounded-lg shadow-md shadow-gray p-8'>
                <div className='mb-4 text-2xl font-semibold text-center'>Secure Remote Control</div>
                <label className='mb-2'>Username</label>
                <input type='text' value={username} placeholder={badLogin ? 'Wrong username or password' : ''} className='mb-4 h-8 bg-gray-100 rounded border border-gray-200 p-[2px] placeholder-red-600' onChange={(e) => setUsername(e.target.value)}/>
                <label className='mb-2'>Password</label>
                <input type='password' value={password} className='mb-4 h-8 bg-gray-100 rounded border border-gray-200 p-[2px]' onChange={(e) => setPassword(e.target.value)}/>
                <ButtonPrimary onClick={handleSubmit} text="Login" />
            </div>
        </div>
    )
}
