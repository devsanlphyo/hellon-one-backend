import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './entities/settings.entity';

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(AppSettings)
    private readonly settingsRepository: Repository<AppSettings>,
  ) {}

  /**
   * Ensure the singleton settings row (id=1) exists on startup.
   */
  async onApplicationBootstrap() {
    const exists = await this.settingsRepository.findOneBy({ id: 1 });
    if (!exists) {
      this.logger.log('Seeding default app settings row...');
      await this.settingsRepository.save({
        id: 1,
        logoUrl: null,
        requireDeviceApproval: true,
        bypassApprovalRoles: ['admin'],
      });
    } else if (exists.bypassApprovalRoles === undefined || exists.requireDeviceApproval === undefined) {
      // Ensure defaults if existing row had null/undefined
      await this.settingsRepository.update(
        { id: 1 },
        {
          requireDeviceApproval: exists.requireDeviceApproval ?? true,
          bypassApprovalRoles: exists.bypassApprovalRoles ?? ['admin'],
        },
      );
    }
  }

  async getSettings(): Promise<AppSettings> {
    let settings = await this.settingsRepository.findOneBy({ id: 1 });
    if (!settings) {
      settings = await this.settingsRepository.save({
        id: 1,
        logoUrl: null,
        requireDeviceApproval: true,
        bypassApprovalRoles: ['admin'],
      });
    }
    // Ensure default arrays if null
    if (!settings.bypassApprovalRoles) {
      settings.bypassApprovalRoles = ['admin'];
    }
    return settings;
  }

  async updateLogoUrl(logoUrl: string): Promise<AppSettings> {
    this.logger.log(`Updating app logo to: ${logoUrl}`);
    await this.settingsRepository.update({ id: 1 }, { logoUrl });
    return this.getSettings();
  }

  async clearLogoUrl(): Promise<AppSettings> {
    this.logger.log('Clearing app logo');
    await this.settingsRepository.update({ id: 1 }, { logoUrl: null });
    return this.getSettings();
  }

  async updateSecuritySettings(dto: {
    requireDeviceApproval?: boolean;
    bypassApprovalRoles?: string[];
  }): Promise<AppSettings> {
    this.logger.log(
      `Updating security settings: requireDeviceApproval=${dto.requireDeviceApproval}, bypassApprovalRoles=${JSON.stringify(
        dto.bypassApprovalRoles,
      )}`,
    );

    const updateData: Partial<AppSettings> = {};
    if (typeof dto.requireDeviceApproval === 'boolean') {
      updateData.requireDeviceApproval = dto.requireDeviceApproval;
    }
    if (Array.isArray(dto.bypassApprovalRoles)) {
      // Always ensure 'admin' is included in bypassApprovalRoles
      const uniqueRoles = Array.from(new Set(['admin', ...dto.bypassApprovalRoles]));
      updateData.bypassApprovalRoles = uniqueRoles;
    }

    await this.settingsRepository.update({ id: 1 }, updateData);
    return this.getSettings();
  }
}
