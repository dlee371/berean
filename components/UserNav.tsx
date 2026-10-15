// The right side of the header: "History" and "Sign out" for logged-in users,
// "Sign in" for visitors.
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function UserNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className="hover:text-ink">
        Sign in
      </Link>
    );
  }

  return (
    <>
      <Link href="/history" className="hover:text-ink">
        History
      </Link>
      <form action="/auth/signout" method="post">
        <button className="hover:text-ink" title={user.email}>
          Sign out
        </button>
      </form>
    </>
  );
}
