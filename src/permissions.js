export function can(permission, permissions) {
  return Array.isArray(permissions) && permissions.includes(permission);
}

export function formatAdminRole(role, locked, isAdmin) {
  if (locked) return "Locked";
  if (role === "super_admin") return "Admin";
  if (role === "people_admin") return "Admin";
  if (role === "community_admin") return "Admin";
  if (role === "read_only_admin") return "Read Only Admin";
  if (isAdmin) return "Admin";
  return "User";
}
