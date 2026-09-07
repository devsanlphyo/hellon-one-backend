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
      await this.settingsRepository.save({ id: 1, logoUrl: null });
    }
  }

  async getSettings(): Promise<AppSettings> {
    let settings = await this.settingsRepository.findOneBy({ id: 1 });
    if (!settings) {
      settings = await this.settingsRepository.save({ id: 1, logoUrl: null });
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
}
