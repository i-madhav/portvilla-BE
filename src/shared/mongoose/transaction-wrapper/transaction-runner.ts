import { Injectable, Logger } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { ClientSession, Connection } from "mongoose";

@Injectable()
export class TransactionRunner {
    private readonly logger = new Logger(TransactionRunner.name);

    constructor(
        @InjectConnection() private readonly connection: Connection
    ){}


  /**
   * Executes `work` inside a MongoDB multi-document transaction.
   *
   * - Commits automatically on success.
   * - Aborts automatically on any thrown error, then re-throws.
   * - Always ends the session (releases the connection back to the pool).
   *
   * @param work  A callback that receives the active ClientSession.
   *              Every Mongoose call inside must be passed `.session(session)`.
   * @returns     The resolved value of `work`.
   * @throws      Re-throws whatever `work` throws, after aborting the transaction.
   */

  async run<T>(work:(session:ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();

    try {
        session.startTransaction();
        const result = await work(session); 
        await session.commitTransaction();
        return result;
    } catch (error) {
       await session.abortTransaction();
       this.logger.error('Transaction aborted due to error', error);
       throw error;
    } finally {
        await session.endSession();
    }
  }
}