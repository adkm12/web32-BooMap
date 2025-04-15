import { Module } from '@nestjs/common';
import { ConnectionController } from './connection.controller';
import { ConnectionService } from './connection.service';
import { UserModule } from '../user/user.module';
import { MindmapModule } from '../mindmap/mindmap.module';
import { RoleModule } from '../role/role.module';
@Module({
  controllers: [ConnectionController],
  imports: [UserModule, MindmapModule, RoleModule],
  providers: [ConnectionService],
})
export class ConnectionModule {}
