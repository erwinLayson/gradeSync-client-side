import AccountSettings from "../developer/DeveloperSettings";

/**
 * Register account settings.
 *
 * The self-service email/password screen only talks to the role-agnostic
 * `PUT /users/:id` endpoint (own-account credential update), the same one
 * Admin/Faculty/Developer settings use — so Register reuses that implementation
 * rather than duplicating it. See docs/register-role-implementation-plan.md.
 */
export default function RegisterSettings() {
  return <AccountSettings />;
}
