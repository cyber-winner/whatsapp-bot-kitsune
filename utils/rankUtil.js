/**
 * rankUtil.js - Centralized Rank Utility
 *
 * Rank structure:
 *  Bronze: 1+
 *  Silver: 101+
 *  Gold: 301+
 *  Platinum: 701+
 *  Diamond: 1501+
 *  Master: 3101+
 *  Grand Master: 6301+
 */

const RANKS = [
    { name: 'Grand Master', minPoints: 6301, badge: '👑' },
    { name: 'Master', minPoints: 3101, badge: '🔥' },
    { name: 'Diamond', minPoints: 1501, badge: '💎' },
    { name: 'Platinum', minPoints: 701, badge: '🪙' },
    { name: 'Gold', minPoints: 301, badge: '🥇' },
    { name: 'Silver', minPoints: 101, badge: '🥈' },
    { name: 'Bronze', minPoints: 1, badge: '🥉' },
    { name: 'Unranked', minPoints: 0, badge: '⚙️' }
];

/**
 * Calculates rank object based on total points.
 * @param {number} points
 * @returns {{ name: string, badge: string, minPoints: number, nextRank: object|null, progressToNext: number }}
 */
function getRank(points = 0) {
    const pts = Math.max(0, Number(points) || 0);
    const rankIndex = RANKS.findIndex(r => pts >= r.minPoints);
    const currentRank = rankIndex !== -1 ? RANKS[rankIndex] : RANKS[RANKS.length - 1];

    const nextRank = rankIndex > 0 ? RANKS[rankIndex - 1] : null;
    let progressToNext = 100;

    if (nextRank) {
        const pointsInTier = pts - currentRank.minPoints;
        const tierSpan = nextRank.minPoints - currentRank.minPoints;
        progressToNext = Math.min(100, Math.floor((pointsInTier / tierSpan) * 100));
    }

    return {
        name: currentRank.name,
        badge: currentRank.badge,
        minPoints: currentRank.minPoints,
        points: pts,
        nextRank: nextRank ? { name: nextRank.name, minPoints: nextRank.minPoints, pointsNeeded: nextRank.minPoints - pts } : null,
        progressToNext
    };
}

/**
 * Returns formatted rank string (e.g., "💎 Diamond (1,550 pts)")
 * @param {number} points
 */
function formatRank(points = 0) {
    const r = getRank(points);
    return `${r.badge} ${r.name}`;
}

module.exports = {
    RANKS,
    getRank,
    formatRank
};
