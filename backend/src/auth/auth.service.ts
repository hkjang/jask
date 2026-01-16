import { Injectable, UnauthorizedException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role || 'USER',
      },
    });

    const token = this.generateToken(user.id, user.email, user.role);

    // 감사 로그: 회원가입
    await this.auditService.logUserManagement('CREATE', `새 사용자 등록: ${user.email}`, {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      ipAddress,
      userAgent,
      metadata: { role: user.role },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken: token,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // 감사 로그: 존재하지 않는 사용자 로그인 시도
      await this.auditService.logAuth('FAILED', `로그인 실패: 존재하지 않는 사용자 (${dto.email})`, {
        userEmail: dto.email,
        ipAddress,
        userAgent,
        success: false,
        errorMessage: '존재하지 않는 사용자',
      });
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (!user.isActive) {
      // 감사 로그: 비활성화된 사용자 로그인 시도
      await this.auditService.logAuth('FAILED', `로그인 실패: 비활성화된 사용자 (${dto.email})`, {
        userId: user.id,
        userEmail: dto.email,
        userName: user.name,
        ipAddress,
        userAgent,
        success: false,
        errorMessage: '비활성화된 사용자',
      });
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      // 감사 로그: 잘못된 비밀번호
      await this.auditService.logAuth('FAILED', `로그인 실패: 잘못된 비밀번호 (${dto.email})`, {
        userId: user.id,
        userEmail: dto.email,
        userName: user.name,
        ipAddress,
        userAgent,
        success: false,
        errorMessage: '잘못된 비밀번호',
      });
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const token = this.generateToken(user.id, user.email, user.role);

    // 감사 로그: 로그인 성공
    await this.auditService.logAuth('LOGIN', `로그인 성공: ${user.email}`, {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      ipAddress,
      userAgent,
      success: true,
      metadata: { role: user.role },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken: token,
    };
  }

  async logout(userId: string, userEmail: string, userName?: string, ipAddress?: string, userAgent?: string) {
    // 감사 로그: 로그아웃
    await this.auditService.logAuth('LOGOUT', `로그아웃: ${userEmail}`, {
      userId,
      userEmail,
      userName,
      ipAddress,
      userAgent,
      success: true,
    });
    return { success: true };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return user;
  }

  private generateToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign({
      sub: userId,
      email,
      role,
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        preferences: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    return {
      ...user,
      customInstructions: (user.preferences as any)?.customInstructions || '',
    };
  }

  async updateProfile(userId: string, data: { name?: string; department?: string; customInstructions?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    const currentPreferences = (user.preferences as any) || {};
    const updatedPreferences = data.customInstructions !== undefined
      ? { ...currentPreferences, customInstructions: data.customInstructions }
      : currentPreferences;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.department !== undefined && { department: data.department }),
        preferences: updatedPreferences,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        preferences: true,
      },
    });

    return {
      ...updated,
      customInstructions: (updated.preferences as any)?.customInstructions || '',
    };
  }
}
