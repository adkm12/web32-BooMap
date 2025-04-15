import { Module } from '@nestjs/common';
import { MindmapService } from './mindmap.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mindmap } from '@app/entity';
import { MindmapController } from './mindmap.controller';
import { NodeModule } from '../node/node.module';
import { UserMindmapRole } from '@app/entity/user.mindmap.role';
import { RoleModule } from '../role/role.module';
@Module({
  imports: [TypeOrmModule.forFeature([Mindmap, UserMindmapRole]), NodeModule, RoleModule],
  providers: [MindmapService],
  exports: [MindmapService],
  controllers: [MindmapController],
})
export class MindmapModule {}
