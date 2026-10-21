import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { configured } from "@/lib/auth";
import { Brand } from "@/components/shell";
export default function SignInPage() {
  if (!configured()) redirect("/setup");
  return (
    <div className="standalone">
      <Brand />
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
