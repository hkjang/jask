import { SetMetadata } from '@nestjs/common';

export const DATASOURCE_ROLES_KEY = 'datasource_roles';

/**
 * Decorator to specify required DataSource role(s) for accessing a route.
 * Use with DataSourceAccessGuard.
 * 
 * Example:
 * @DataSourceRoles('EDITOR', 'ADMIN')
 * @UseGuards(DataSourceAccessGuard)
 */
export const DataSourceRoles = (...roles: ('VIEWER' | 'EDITOR' | 'ADMIN')[]) => 
  SetMetadata(DATASOURCE_ROLES_KEY, roles);
