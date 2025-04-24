import {createContext} from "react";
import {User} from "../components/types/user";

export const UserContext = createContext<User | null>(null);
