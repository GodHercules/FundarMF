import { redirect } from "next/navigation";

/**
 * The operator area uses the unified login at `/`.
 * Keep this route as a compatibility redirect for old bookmarks and links.
 */
export default function OperatorLoginRedirect() {
  redirect("/");
}
