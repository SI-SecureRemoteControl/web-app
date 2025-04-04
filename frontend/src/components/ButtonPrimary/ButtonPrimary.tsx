interface ButtonProps {
    text: string;
    onClick: () => void;
}

export default function ButtonPrimary({onClick, text}: ButtonProps) {
    return (
        <button onClick={onClick} className='bg-slate-800 text-white w-24 h-10 rounded hover:bg-slate-600 cursor-pointer'>
            {text}
        </button>
    )
}