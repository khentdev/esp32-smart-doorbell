#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0292416a809ea388b1f6d1ed4bb8f5ea5262fa985705077e41d645c5cdc1ba4d/contract';
import endContract from '../../snapshots/0292416a809ea388b1f6d1ed4bb8f5ea5262fa985705077e41d645c5cdc1ba4d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/2f49c3f0d926fac3e6aaee361185ac3eb2d1597796ab6131dd90e1921df5a02a/contract';
import startContract from '../../snapshots/2f49c3f0d926fac3e6aaee361185ac3eb2d1597796ab6131dd90e1921df5a02a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'Session' }),
      this.dropColumn({ schema: 'public', table: 'User', column: 'name' }),
      this.dropConstraint({ schema: 'public', table: 'User', constraint: 'User_email_key' }),
      this.dropColumn({ schema: 'public', table: 'User', column: 'email' }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('hashedPassword', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'User', column: 'hashedPassword' }),
      this.setNotNull({ schema: 'public', table: 'User', column: 'username' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
