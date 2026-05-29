import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  IUserRepository,
  CreateUserData,
} from '../../domain/user-repository.interface';
import { IUserRecord, UserDocument } from '../../interfaces/user.interface';

export const USER_MODEL = 'User';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(USER_MODEL) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(data: CreateUserData): Promise<IUserRecord> {
    const doc = await this.userModel.create(data);
    return this.toRecord(doc);
  }

  async findByEmail(email: string): Promise<IUserRecord | null> {
    const doc = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .exec();
    return doc ? this.toRecord(doc) : null;
  }

  async findById(id: string): Promise<IUserRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.userModel.findById(id).exec();
    return doc ? this.toRecord(doc) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.userModel
      .countDocuments({ email: email.toLowerCase() })
      .exec();
    return count > 0;
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { isEmailVerified: true })
      .exec();
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { refreshTokenHash: hash })
      .exec();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Converts a UserDocument into a plain IUserRecord, stripping Mongoose internals. */
  private toRecord(doc: UserDocument): IUserRecord {
    return {
      id: (doc._id as Types.ObjectId).toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      isEmailVerified: doc.isEmailVerified,
      role: doc.role,
      refreshTokenHash: doc.refreshTokenHash,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
