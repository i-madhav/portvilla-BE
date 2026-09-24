import { AssetKind, assetPolicies } from '../domain/asset.interface';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

interface IsAssetValidResponse{
  reason: string,
  isSafe: boolean
}

export async function isAssetValid(kind:AssetKind ,file: Buffer , declared: {
  filename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
}): Promise<IsAssetValidResponse> {
  
  if (!file)
    throw new Error(
      'Unable to check the file , see if the file is really present or not',
    );

  const allowedContent = {
    allowedContentTypes: assetPolicies[kind].allowedContentTypes, 
    allowedMaxSizeInBytes: assetPolicies[kind].maxSizeInBytes, 
    allowedMaxPixels: assetPolicies[kind].maxPixels,
    allowedMaxEdge: assetPolicies[kind].maxEdge
  }

  const { allowedContentTypes , allowedMaxEdge , allowedMaxPixels , allowedMaxSizeInBytes} = allowedContent;
 
  //Inspect the actual byte
  const actualByte = await fileTypeFromBuffer(file.buffer); 
  if (!actualByte) throw new Error("Unable to get real Byte");
  
  const actualMetadata = await sharp(file.buffer).metadata();
  if (!actualMetadata) throw new Error("Unable to get actual Metadata");  

  const actualMeta = {
    height: actualMetadata?.height,
    width: actualMetadata?.width,
    byteSize: actualMetadata?.size
  }
  const actualExtension = actualByte?.mime ?? null; // image/jpeg
  
  if (!allowedContentTypes.includes(actualExtension)) return {
    reason: "The actual asset content type doesn't match the type in the allowed list ",
    isSafe:false
  };

  if (declared.contentType !== actualExtension) return {
    reason: "The declared content type doesn't match the actual content type",
    isSafe: false
  }

  if (((actualMeta.height * actualMeta.width) > allowedMaxPixels) || Math.max(actualMeta.height, actualMeta.width) > allowedMaxEdge) return {
    reason: "The actual dimension of the asset doesn't comply with the allowed limit",
    isSafe:false
  }

  if (declared.byteSize > allowedMaxSizeInBytes || (actualMeta?.byteSize > allowedMaxSizeInBytes) ) return {
    reason: "The actual byte size is greater than the allowed ones",
    isSafe:false
  }

  return {
    reason: "This Asset is safe",
    isSafe:true
    }
}