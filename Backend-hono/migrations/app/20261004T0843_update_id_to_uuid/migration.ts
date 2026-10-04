#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0292416a809ea388b1f6d1ed4bb8f5ea5262fa985705077e41d645c5cdc1ba4d/contract';
import startContract from '../../snapshots/0292416a809ea388b1f6d1ed4bb8f5ea5262fa985705077e41d645c5cdc1ba4d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a9226732d1e1d567fd297a6ae1ed464e533d04b7e57ca7d8dc57e8f23e642f5c/contract';
import endContract from '../../snapshots/a9226732d1e1d567fd297a6ae1ed464e533d04b7e57ca7d8dc57e8f23e642f5c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropDefault({ schema: 'public', table: 'User', column: 'id' }),
      this.alterColumnType({
        schema: 'public',
        table: 'User',
        column: 'id',
        options: {
          qualifiedTargetType: 'uuid',
          formatTypeExpected: 'uuid',
          rawTargetTypeForLabel: 'uuid',
          using: 'gen_random_uuid()',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
