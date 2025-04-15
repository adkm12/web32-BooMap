import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MindmapModule } from '../mindmap/mindmap.module';
import { NodeModule } from '../node/node.module';
import { RoleModule } from '../role/role.module';
@Module({
  controllers: [DashboardController],
  imports: [MindmapModule, NodeModule, RoleModule],
  providers: [DashboardService],
})
export class DashboardModule {}
