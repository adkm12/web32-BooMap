import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserMindmapRole } from '@app/entity';
import { Repository } from 'typeorm';
import { UserCreateDto, UserInfoDto } from './dto';

export type UserType = 'github' | 'kakao';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserMindmapRole) private readonly userMindmapRoleRepository: Repository<UserMindmapRole>,
  ) {}

  async createUser(user: UserCreateDto, type: UserType) {
    if (!user.email || !user.name) {
      throw new BadRequestException('이메일과 이름은 필수 입력 항목입니다.');
    }
    const createdUser = this.userRepository.create({ email: user.email, name: user.name, type });
    return await this.userRepository.save(createdUser);
  }

  async findByEmail(email: string, type: UserType) {
    return await this.userRepository.findOne({ where: { email, type } });
  }

  async findById(id: number) {
    return await this.userRepository.findOne({ where: { id } });
  }

  async getUserInfo(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    } as UserInfoDto;
  }

  async getRole(userId: number, mindmapId: number) {
    const userMindmapRole = await this.userMindmapRoleRepository.findOne({
      where: { user: { id: userId }, mindmap: { id: mindmapId } },
    });

    return userMindmapRole?.role ?? null;
  }
}
