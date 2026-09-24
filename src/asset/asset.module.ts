import { Module } from '@nestjs/common';
import { AssetController } from './asset.controller';
import { MongooseModule, Schema } from '@nestjs/mongoose';
import {
  DB_MODEL_REGISTRY,
  DbModelToken,
} from '../shared/mongoose/modelRegistry/mongoose.modelRegistry';
import { AssetSchema } from './infrastructure/schema/asset.schema';
import { AssetRepository } from './infrastructure/repository/asset.repository';
import { ASSET_REPOSITORY } from './domain/asset-repository.interface';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DB_MODEL_REGISTRY.ASSET.MODEL_TOKEN as DbModelToken,
        schema: AssetSchema,
      },
    ]),
  ],
  controllers: [AssetController],
  providers: [
    {
      provide: ASSET_REPOSITORY,
      useClass: AssetRepository,
    },
  ],
})
export class AssetModule {}
