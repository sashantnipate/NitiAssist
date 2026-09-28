import { SignUp } from "@clerk/nextjs"

const Page = () => {
    return(
        <div className="flex min-h-screen items-center justify-center py-8">
            <SignUp />
        </div>
    )
}

export default Page;
