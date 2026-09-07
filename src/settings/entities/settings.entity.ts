import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Single-row application settings table (row id is always 1).
 * Managed exclusively through SettingsService.upsert().
 */
@Entity('app_settings')
export class AppSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  /** Public URL path to the app logo, e.g. /uploads/logo-xyz.png */
  @Column({ nullable: true, type: 'varchar' })
  logoUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
