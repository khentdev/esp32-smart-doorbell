// Types for the auth API

export type UserData = {
    username: string
}
export type LoginInput = {
    username: string
    password: string
}
export type LoginResponse = {
    user: UserData
}