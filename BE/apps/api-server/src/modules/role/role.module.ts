import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserMindmapRole } from '@app/entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserMindmapRole])],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
