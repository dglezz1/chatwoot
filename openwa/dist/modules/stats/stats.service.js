"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsService = void 0;
exports.timeSeriesTimestampSql = timeSeriesTimestampSql;
exports.hourBucketSql = hourBucketSql;
exports.maxCreatedAtSql = maxCreatedAtSql;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("../session/entities/session.entity");
const message_entity_1 = require("../message/entities/message.entity");
const cache_1 = require("../../common/cache");
function timeSeriesTimestampSql(dbType, interval) {
    if (dbType === 'postgres') {
        const fmt = interval === 'hour' ? 'YYYY-MM-DD HH24:00:00' : 'YYYY-MM-DD';
        return `to_char(m."createdAt", '${fmt}')`;
    }
    const fmt = interval === 'hour' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d';
    return `strftime('${fmt}', m.createdAt)`;
}
function hourBucketSql(dbType) {
    return dbType === 'postgres'
        ? `CAST(EXTRACT(HOUR FROM m."createdAt") AS INTEGER)`
        : `CAST(strftime('%H', m.createdAt) AS INTEGER)`;
}
function maxCreatedAtSql(dbType) {
    return dbType === 'postgres'
        ? `to_char(MAX(m."createdAt"), 'YYYY-MM-DD HH24:MI:SS')`
        : `strftime('%Y-%m-%d %H:%M:%S', MAX(m.createdAt))`;
}
let StatsService = class StatsService {
    sessionRepo;
    messageRepo;
    cacheService;
    constructor(sessionRepo, messageRepo, cacheService) {
        this.sessionRepo = sessionRepo;
        this.messageRepo = messageRepo;
        this.cacheService = cacheService;
    }
    get dataDbType() {
        return this.messageRepo.manager.connection.options.type;
    }
    async getOverview() {
        const sessions = await this.sessionRepo.find();
        const byStatus = {};
        let active = 0;
        for (const session of sessions) {
            byStatus[session.status] = (byStatus[session.status] || 0) + 1;
            if (session.status === session_entity_1.SessionStatus.READY)
                active++;
        }
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const messageStats = await this.messageRepo
            .createQueryBuilder('m')
            .select('m.direction', 'direction')
            .addSelect('COUNT(*)', 'count')
            .groupBy('m.direction')
            .getRawMany();
        const todayStats = await this.messageRepo
            .createQueryBuilder('m')
            .select('m.direction', 'direction')
            .addSelect('COUNT(*)', 'count')
            .where('m.createdAt >= :todayStart', { todayStart })
            .groupBy('m.direction')
            .getRawMany();
        const sent = parseInt(messageStats.find(m => m.direction === 'outgoing')?.count || '0');
        const received = parseInt(messageStats.find(m => m.direction === 'incoming')?.count || '0');
        const todaySent = parseInt(todayStats.find(m => m.direction === 'outgoing')?.count || '0');
        const todayReceived = parseInt(todayStats.find(m => m.direction === 'incoming')?.count || '0');
        const failed = await this.messageRepo.count({
            where: { status: message_entity_1.MessageStatus.FAILED },
        });
        await this.cacheService.setSessionsStats({
            active,
            total: sessions.length,
            byStatus,
        });
        return {
            sessions: {
                active,
                total: sessions.length,
                byStatus,
            },
            messages: {
                sent,
                received,
                failed,
                today: { sent: todaySent, received: todayReceived },
            },
        };
    }
    async getMessageStats(period) {
        const since = this.getPeriodStart(period);
        const interval = period === '24h' ? 'hour' : 'day';
        const timeSeries = await this.getTimeSeries(since, interval);
        const byTypeRaw = await this.messageRepo
            .createQueryBuilder('m')
            .select('m.type', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('m.createdAt >= :since', { since })
            .groupBy('m.type')
            .getRawMany();
        const byType = {};
        for (const row of byTypeRaw) {
            byType[row.type || 'unknown'] = parseInt(row.count);
        }
        const bySessionRaw = await this.messageRepo
            .createQueryBuilder('m')
            .select('m.sessionId', 'sessionId')
            .addSelect('m.direction', 'direction')
            .addSelect('COUNT(*)', 'count')
            .where('m.createdAt >= :since', { since })
            .groupBy('m.sessionId')
            .addGroupBy('m.direction')
            .getRawMany();
        const sessionMap = new Map();
        for (const row of bySessionRaw) {
            if (!sessionMap.has(row.sessionId)) {
                sessionMap.set(row.sessionId, { sent: 0, received: 0 });
            }
            const entry = sessionMap.get(row.sessionId);
            if (row.direction === 'outgoing')
                entry.sent = parseInt(row.count);
            else
                entry.received = parseInt(row.count);
        }
        const sessions = await this.sessionRepo.find();
        const sessionNames = new Map(sessions.map(s => [s.id, s.name]));
        const bySession = Array.from(sessionMap.entries()).map(([sessionId, stats]) => ({
            sessionId,
            name: sessionNames.get(sessionId) || 'Unknown',
            ...stats,
        }));
        const topChats = await this.messageRepo
            .createQueryBuilder('m')
            .select('m.chatId', 'chatId')
            .addSelect('COUNT(*)', 'messageCount')
            .addSelect('MAX(m.chatName)', 'chatName')
            .where('m.createdAt >= :since', { since })
            .groupBy('m.chatId')
            .orderBy('COUNT(*)', 'DESC')
            .limit(10)
            .getRawMany();
        return {
            timeSeries,
            byType,
            bySession,
            topChats: topChats.map(c => ({
                chatId: c.chatId,
                chatName: c.chatName ?? null,
                messageCount: parseInt(c.messageCount),
            })),
        };
    }
    async getSessionStats(sessionId) {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const stats = await this.messageRepo
            .createQueryBuilder('m')
            .select('m.direction', 'direction')
            .addSelect('COUNT(*)', 'count')
            .where('m.sessionId = :sessionId', { sessionId })
            .groupBy('m.direction')
            .getRawMany();
        const todayCount = await this.messageRepo
            .createQueryBuilder('m')
            .where('m.sessionId = :sessionId', { sessionId })
            .andWhere('m.createdAt >= :todayStart', { todayStart })
            .getCount();
        const sent = parseInt(stats.find(s => s.direction === 'outgoing')?.count || '0');
        const received = parseInt(stats.find(s => s.direction === 'incoming')?.count || '0');
        const failed = await this.messageRepo.count({
            where: { sessionId, status: message_entity_1.MessageStatus.FAILED },
        });
        const topChats = await this.messageRepo
            .createQueryBuilder('m')
            .select('m.chatId', 'chatId')
            .addSelect('COUNT(*)', 'count')
            .addSelect(maxCreatedAtSql(this.dataDbType), 'lastActive')
            .addSelect('MAX(m.chatName)', 'chatName')
            .where('m.sessionId = :sessionId', { sessionId })
            .groupBy('m.chatId')
            .orderBy('count', 'DESC')
            .limit(10)
            .getRawMany();
        const hourlyActivity = await this.getHourlyActivity(sessionId);
        return {
            session: { id: session.id, name: session.name, status: session.status },
            messages: { sent, received, today: todayCount, failed },
            topChats: topChats.map(c => ({
                chatId: c.chatId,
                chatName: c.chatName ?? null,
                count: parseInt(c.count),
                lastActive: c.lastActive,
            })),
            hourlyActivity,
        };
    }
    getPeriodStart(period) {
        const now = new Date();
        switch (period) {
            case '24h':
                return new Date(now.getTime() - 24 * 60 * 60 * 1000);
            case '7d':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case '30d':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
    }
    async getTimeSeries(since, interval) {
        const raw = await this.messageRepo
            .createQueryBuilder('m')
            .select(timeSeriesTimestampSql(this.dataDbType, interval), 'bucket')
            .addSelect(`SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END)`, 'sent')
            .addSelect(`SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END)`, 'received')
            .where('m.createdAt >= :since', { since })
            .groupBy('bucket')
            .orderBy('bucket', 'ASC')
            .getRawMany();
        return raw.map(r => ({
            timestamp: r.bucket,
            sent: parseInt(r.sent || '0'),
            received: parseInt(r.received || '0'),
        }));
    }
    async getHourlyActivity(sessionId) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const raw = await this.messageRepo
            .createQueryBuilder('m')
            .select(hourBucketSql(this.dataDbType), 'hour')
            .addSelect(`SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END)`, 'sent')
            .addSelect(`SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END)`, 'received')
            .where('m.sessionId = :sessionId', { sessionId })
            .andWhere('m.createdAt >= :since', { since })
            .groupBy('hour')
            .orderBy('hour', 'ASC')
            .getRawMany();
        const result = [];
        const hourMap = new Map(raw.map(r => [parseInt(r.hour), r]));
        for (let h = 0; h < 24; h++) {
            const data = hourMap.get(h);
            result.push({
                hour: h,
                sent: data ? parseInt(data.sent || '0') : 0,
                received: data ? parseInt(data.received || '0') : 0,
            });
        }
        return result;
    }
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(session_entity_1.Session, 'data')),
    __param(1, (0, typeorm_1.InjectRepository)(message_entity_1.Message, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        cache_1.CacheService])
], StatsService);
//# sourceMappingURL=stats.service.js.map