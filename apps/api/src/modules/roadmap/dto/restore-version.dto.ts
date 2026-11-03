import { IsInt, IsOptional } from 'class-validator';

// Launchpad Phase 5B, Slice 5B-11: optional so omitting it reproduces the unprotected restore
// behavior from slice 5B-1, per the plan's own rollback note. When supplied, the node's version
// at the moment the restore is actually applied must still match this value, or the restore is
// refused with a conflict rather than silently overwriting a change that landed between when the
// professor loaded the page and when they clicked restore.
export class RestoreVersionDto {
  @IsInt()
  @IsOptional()
  expectedVersion?: number;
}
