import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserMindmapRole } from '@app/entity';
import { In, Repository } from 'typeorm';
import { Role } from '@app/entity/enum/role.enum';

interface OwnerInfo {
  mindmapId: number;
  userId: number;
  ownerName: string;
}

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(UserMindmapRole)
    private readonly userMindmapRoleRepository: Repository<UserMindmapRole>,
  ) {}

  async getUserRole(userId: number, mindmapId: number): Promise<Role | null> {
    const userMindmapRole = await this.userMindmapRoleRepository.findOne({
      where: { user: { id: userId }, mindmap: { id: mindmapId } },
    });
    return userMindmapRole?.role ?? null;
  }

  async assignRole(userId: number, mindmapId: number, role: Role = Role.OWNER): Promise<UserMindmapRole> {
    const existingRole = await this.userMindmapRoleRepository.findOne({
      where: {
        user: { id: userId },
        mindmap: { id: mindmapId },
      },
    });

    if (existingRole) {
      if (existingRole.role !== role) {
        existingRole.role = role;
        return await this.userMindmapRoleRepository.save(existingRole);
      }
      return existingRole;
    }

    const userMindmapRole = this.userMindmapRoleRepository.create({
      user: { id: userId },
      mindmap: { id: mindmapId },
      role,
    });

    return await this.userMindmapRoleRepository.save(userMindmapRole);
  }

  async getMindmapOwner(mindmapIdOrIds: number | number[]): Promise<OwnerInfo[]> {
    return typeof mindmapIdOrIds === 'number'
      ? await this.getMindmapOwnerByMindmapId(mindmapIdOrIds)
      : await this.getAllMindmapOwner(mindmapIdOrIds);
  }

  private async getAllMindmapOwner(mindmapIds: number[]): Promise<OwnerInfo[]> {
    const owners = await this.userMindmapRoleRepository.find({
      where: { mindmap: { id: In(mindmapIds) }, role: Role.OWNER },
      relations: ['user', 'mindmap'],
    });
    return owners.map((owner) => ({
      mindmapId: owner.mindmap.id,
      userId: owner.user.id,
      ownerName: owner.user.name,
    }));
  }

  private async getMindmapOwnerByMindmapId(mindmapId: number): Promise<OwnerInfo[]> {
    const owner = await this.userMindmapRoleRepository.findOne({
      where: { mindmap: { id: mindmapId }, role: Role.OWNER },
      relations: ['user', 'mindmap'],
    });
    return owner ? [{ mindmapId: owner.mindmap.id, userId: owner.user.id, ownerName: owner.user.name }] : [];
  }

  async verifyUserIsOwner(userId: number, mindmapId: number): Promise<boolean> {
    const role = await this.getUserRole(userId, mindmapId);
    return role === Role.OWNER;
  }
}
