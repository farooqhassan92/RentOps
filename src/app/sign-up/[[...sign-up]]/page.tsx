import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { configured } from "@/lib/auth";
import { Brand } from "@/components/shell";
export default function SignUpPage() {
  if (!configured()) redirect("/setup");
  return (
    <div className="standalone">
      <Brand />
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
      />
    </div>
  );
}
