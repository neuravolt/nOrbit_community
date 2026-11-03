import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MeetingStatus } from '@prisma/client';
import {
  CreateMeetingDto,
  UpdateMeetingDto,
  ListMeetingsQueryDto,
} from './dto';

const SLUG_CHARACTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Generates a cryptographically random 8-character URL-safe slug with collision protection.
   */
  private async generateUniqueSlug(): Promise<string> {
    const attempts = 5;
    for (let i = 0; i < attempts; i++) {
      const bytes = crypto.randomBytes(6);
      let slug = '';
      for (let j = 0; j < 8; j++) {
        const byteValue = bytes[j % bytes.length];
        slug += SLUG_CHARACTERS[byteValue % SLUG_CHARACTERS.length];
      }

      const existing = await this.prisma.meeting.findUnique({
        where: { slug },
      });
      if (!existing) {
        return slug;
      }
    }
    // Fallback suffix if collision occurs repeatedly
    return `${Date.now().toString(36).toUpperCase().slice(-8)}`;
  }

  /**
   * Evaluates if a meeting is expired based on meetingDate and scheduled duration window.
   */
  private computeMeetingStatus(meeting: {
    status: MeetingStatus;
    meetingDate: Date;
  }): MeetingStatus {
    if (meeting.status === MeetingStatus.CANCELLED) {
      return MeetingStatus.CANCELLED;
    }

    // Default expiration rule: Meeting expires 24 hours after the scheduled meeting time
    const now = new Date();
    const expiryTime = new Date(
      meeting.meetingDate.getTime() + 24 * 60 * 60 * 1000,
    );

    if (now > expiryTime) {
      return MeetingStatus.EXPIRED;
    }

    return meeting.status;
  }

  async create(createMeetingDto: CreateMeetingDto, createdById?: string) {
    const { title, meetingDate, meetingUrl, pin } = createMeetingDto;

    const pinHash = await bcrypt.hash(pin, 10);
    const slug = await this.generateUniqueSlug();

    return this.prisma.meeting.create({
      data: {
        title: title.trim(),
        meetingDate: new Date(meetingDate),
        meetingUrl: meetingUrl.trim(),
        pinHash,
        pin: pin.trim(),
        slug,
        status: MeetingStatus.ACTIVE,
        createdById: createdById || null,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findAll(query: ListMeetingsQueryDto) {
    const { search, status, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      deletedAt: null,
    };

    if (search && search.trim()) {
      where.title = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    if (status && status !== 'ALL') {
      where.status = status as MeetingStatus;
    }

    const [meetings, total] = await Promise.all([
      this.prisma.meeting.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { meetingDate: 'desc' },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.meeting.count({ where }),
    ]);

    // Dynamically compute status for expired meetings
    const computedMeetings = meetings.map((m) => ({
      ...m,
      computedStatus: this.computeMeetingStatus(m),
    }));

    return {
      meetings: computedMeetings,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async findOne(id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting record not found');
    }

    return {
      ...meeting,
      computedStatus: this.computeMeetingStatus(meeting),
    };
  }

  async update(id: string, updateMeetingDto: UpdateMeetingDto) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, deletedAt: null },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting record not found');
    }

    const data: any = {};

    if (updateMeetingDto.title) {
      data.title = updateMeetingDto.title.trim();
    }
    if (updateMeetingDto.meetingDate) {
      data.meetingDate = new Date(updateMeetingDto.meetingDate);
    }
    if (updateMeetingDto.meetingUrl) {
      data.meetingUrl = updateMeetingDto.meetingUrl.trim();
    }
    if (updateMeetingDto.status) {
      data.status = updateMeetingDto.status;
    }
    if (updateMeetingDto.pin) {
      data.pinHash = await bcrypt.hash(updateMeetingDto.pin, 10);
      data.pin = updateMeetingDto.pin.trim();
    }

    return this.prisma.meeting.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async cancel(id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, deletedAt: null },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting record not found');
    }

    return this.prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.CANCELLED },
    });
  }

  async delete(id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, deletedAt: null },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting record not found');
    }

    return this.prisma.meeting.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Public Endpoint 1: Fetch safe meeting metadata by slug.
   * STRICTLY excludes meetingUrl, pinHash, createdById, internal database IDs.
   */
  async findPublicBySlug(slug: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { slug: slug.trim(), deletedAt: null },
      select: {
        title: true,
        meetingDate: true,
        status: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const computedStatus = this.computeMeetingStatus(meeting);

    return {
      title: meeting.title,
      meetingDate: meeting.meetingDate,
      status: computedStatus,
    };
  }

  /**
   * Public Endpoint 2: Verify 4-digit PIN.
   * Returns a 5-minute single-purpose authorization token.
   * Does NOT return the Google Meet URL directly.
   */
  async verifyPublicPin(slug: string, pin: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { slug: slug.trim(), deletedAt: null },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const currentStatus = this.computeMeetingStatus(meeting);

    if (currentStatus === MeetingStatus.CANCELLED) {
      throw new BadRequestException('This meeting has been cancelled.');
    }

    if (currentStatus === MeetingStatus.EXPIRED) {
      throw new BadRequestException('This meeting is no longer available.');
    }

    const isPinValid = await bcrypt.compare(pin, meeting.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedException(
        'Incorrect PIN. Please enter the correct 4-digit PIN.',
      );
    }

    // Generate short-lived (5-minute) meeting access token
    const meetingToken = this.jwtService.sign(
      {
        slug: meeting.slug,
        meetingId: meeting.id,
        type: 'meeting_join_grant',
      },
      { expiresIn: '5m' },
    );

    return {
      verified: true,
      meetingToken,
    };
  }

  /**
   * Public Endpoint 3: Token Exchange to obtain Google Meet URL.
   * Validates short-lived meeting access token before releasing URL.
   */
  async joinMeeting(slug: string, token: string) {
    try {
      const payload = this.jwtService.verify(token);

      if (
        payload.slug !== slug.trim() ||
        payload.type !== 'meeting_join_grant'
      ) {
        throw new UnauthorizedException('Invalid or expired meeting session');
      }

      const meeting = await this.prisma.meeting.findFirst({
        where: { id: payload.meetingId, deletedAt: null },
      });

      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      const currentStatus = this.computeMeetingStatus(meeting);
      if (
        currentStatus === MeetingStatus.CANCELLED ||
        currentStatus === MeetingStatus.EXPIRED
      ) {
        throw new BadRequestException('This meeting is no longer joinable.');
      }

      return {
        meetingUrl: meeting.meetingUrl,
      };
    } catch (err: any) {
      throw new UnauthorizedException(
        err?.message || 'Invalid or expired meeting authorization token',
      );
    }
  }
}
