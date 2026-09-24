// This is base interface is for all the entities in the project like , entities like id , timestamps etc. will be defined in this interface and all the entities will extend this interface
export interface IBase {
  createdAt: Date;
  updatedAt: Date;
}
