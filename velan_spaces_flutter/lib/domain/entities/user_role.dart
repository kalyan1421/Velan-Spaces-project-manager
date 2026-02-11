enum UserRole {
  head,
  manager,
  worker,
  client,
  unknown,
}

UserRole userRoleFromString(String? role) {
  switch (role?.toUpperCase()) {
    case 'HEAD':
      return UserRole.head;
    case 'MANAGER':
      return UserRole.manager;
    case 'WORKER':
      return UserRole.worker;
    case 'CLIENT':
      return UserRole.client;
    default:
      return UserRole.unknown;
  }
}
