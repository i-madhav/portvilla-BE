import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { DB_MODEL_REGISTRY } from '../shared/mongoose/modelRegistry/mongoose.modelRegistry';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { ASSET_REPOSITORY } from './domain/asset-repository.interface';
import { OBJECT_STORAGE } from './domain/object-storage.interface';
import { AssetRepository } from './infrastructure/repository/asset.repository';
import { AssetSchema } from './infrastructure/schema/asset.schema';
import { createObjectStorage } from './infrastructure/storage/storage.factory';
import { LocalStorageController } from './local-storage.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DB_MODEL_REGISTRY.ASSET.MODEL_TOKEN, schema: AssetSchema },
    ]),
  ],
  controllers: [AssetController, LocalStorageController],
  providers: [
    AssetService,
    { provide: ASSET_REPOSITORY, useClass: AssetRepository },
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: createObjectStorage,
    },
  ],
})
export class AssetModule {}
