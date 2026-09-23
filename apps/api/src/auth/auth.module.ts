import { Module } from '@nestjs/common';
import { AuthMeController } from './auth-me.controller';
import { RolesGuard } from './guards/roles.guard';
import { IdentityProvisioningService } from './identity-provisioning.service';

@Module({
  controllers: [AuthMeController],
  providers: [IdentityProvisioningService, RolesGuard],
  exports: [IdentityProvisioningService, RolesGuard],
})
export class AuthModule {}
