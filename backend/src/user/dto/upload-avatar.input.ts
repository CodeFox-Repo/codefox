import { Field, InputType } from '@nestjs/graphql';
import { FileUpload, GraphQLUpload } from 'graphql-upload-minimal';

@InputType()
export class UploadAvatarInput {
  @Field(() => GraphQLUpload)
  file: Promise<FileUpload>;
}
