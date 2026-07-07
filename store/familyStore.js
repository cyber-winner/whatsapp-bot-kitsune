const Family = require('../models/Family');
class FamilyStore {
  constructor() {
    this.pendingProposals = new Map();
    this.pendingDivorces = new Map();
    this.celestiaMarryRequests = new Map();
  }
  hasValidProposal(key) {
    if (!this.pendingProposals.has(key)) return false;
    const timestamp = this.pendingProposals.get(key);
    if (Date.now() - timestamp > 60000) {
      this.pendingProposals.delete(key);
      return false;
    }
    return true;
  }
  async getFamily(userId) {
    let family = await Family.findOne({
      userId
    });
    if (!family) {
      family = new Family({
        userId
      });
      await family.save();
    }
    return family;
  }
  async areSiblings(user1, user2) {
    const f1 = await this.getFamily(user1);
    const f2 = await this.getFamily(user2);
    return f1.parents.some(p => f2.parents.includes(p));
  }
  async isParentOf(parentId, childId) {
    const cFamily = await this.getFamily(childId);
    return cFamily.parents.includes(parentId);
  }
  async isGrandparentOf(grandparentId, grandchildId) {
    const gcFamily = await this.getFamily(grandchildId);
    for (const parentId of gcFamily.parents) {
      const pFamily = await this.getFamily(parentId);
      if (pFamily.parents.includes(grandparentId)) return true;
    }
    return false;
  }
  async validateMarriage(user1, user2) {
    const f1 = await this.getFamily(user1);
    const f2 = await this.getFamily(user2);
    if (f1.spouse === user2) return {
      allowed: false,
      reason: 'already_married'
    };
    if (f1.spouse) return {
      allowed: false,
      reason: 'already_married_other',
      currentSpouse: f1.spouse
    };
    if (f2.spouse) return {
      allowed: false,
      reason: 'target_married',
      currentSpouse: f2.spouse
    };
    if (await this.areSiblings(user1, user2)) return {
      allowed: false,
      reason: 'siblings'
    };
    if ((await this.isParentOf(user1, user2)) || (await this.isParentOf(user2, user1))) {
      return {
        allowed: false,
        reason: 'parent_child'
      };
    }
    if ((await this.isGrandparentOf(user1, user2)) || (await this.isGrandparentOf(user2, user1))) {
      return {
        allowed: false,
        reason: 'grandparent'
      };
    }
    return {
      allowed: true
    };
  }
  async marry(user1, user2) {
    const validation = await this.validateMarriage(user1, user2);
    if (!validation.allowed) return validation;
    const propKey = `marry-${user1}-${user2}`;
    if (this.hasValidProposal(propKey)) {
      this.pendingProposals.delete(propKey);
      const f1 = await this.getFamily(user1);
      const f2 = await this.getFamily(user2);
      f1.spouse = user2;
      f2.spouse = user1;
      f1.proposedBy = user2;
      f2.proposedBy = user2;
      f1.marriedAt = new Date();
      f2.marriedAt = new Date();
      f1.ex_partners = f1.ex_partners.filter(p => p !== user2);
      f2.ex_partners = f2.ex_partners.filter(p => p !== user1);
      await f1.save();
      await f2.save();
      return {
        status: 'married',
        proposer: user2
      };
    } else {
      const newPropKey = `marry-${user2}-${user1}`;
      this.pendingProposals.set(newPropKey, Date.now());
      return {
        status: 'proposed',
        proposer: user1
      };
    }
  }
  async forceMarry(user1, user2) {
    const f1 = await this.getFamily(user1);
    const f2 = await this.getFamily(user2);
    if (f1.spouse) {
      const exSpouseFamily = await this.getFamily(f1.spouse);
      exSpouseFamily.spouse = null;
      exSpouseFamily.proposedBy = null;
      if (!exSpouseFamily.ex_partners.includes(user1)) exSpouseFamily.ex_partners.push(user1);
      await exSpouseFamily.save();
    }
    if (f2.spouse) {
      const exSpouseFamily = await this.getFamily(f2.spouse);
      exSpouseFamily.spouse = null;
      exSpouseFamily.proposedBy = null;
      if (!exSpouseFamily.ex_partners.includes(user2)) exSpouseFamily.ex_partners.push(user2);
      await exSpouseFamily.save();
    }
    f1.spouse = user2;
    f2.spouse = user1;
    f1.proposedBy = user1;
    f2.proposedBy = user1;
    f1.marriedAt = new Date();
    f2.marriedAt = new Date();
    f1.forcedSpouse = true;
    f2.forcedSpouse = true;
    f1.ex_partners = f1.ex_partners.filter(p => p !== user2);
    f2.ex_partners = f2.ex_partners.filter(p => p !== user1);
    await f1.save();
    await f2.save();
    return 'married';
  }
  async divorce(user1, user2, isForce = false) {
    const f1 = await this.getFamily(user1);
    const f2 = await this.getFamily(user2);
    if (f1.spouse !== user2 || f2.spouse !== user1) return {
      status: 'not_married'
    };
    if (!isForce && (f1.forcedSpouse || f2.forcedSpouse)) {
      return {
        status: 'forced_relationship'
      };
    }
    const divorceKey1 = `divorce-${user1}-${user2}`;
    const divorceKey2 = `divorce-${user2}-${user1}`;
    if (this.pendingDivorces.has(divorceKey2)) {
      this.pendingDivorces.delete(divorceKey2);
      const initiator = user2;
      const nonInitiator = user1;
      const fInitiator = f2;
      const fNonInitiator = f1;
      let hasChildAdoptedDuringMarriage = false;
      const sharedChildren = fInitiator.children.filter(c => fNonInitiator.children.includes(c));
      for (const childId of sharedChildren) {
        const childFamily = await this.getFamily(childId);
        const adoptedByInitiatorDate = fInitiator.adoptionDates ? fInitiator.adoptionDates.get(childId) : null;
        const adoptedByNonInitiatorDate = fNonInitiator.adoptionDates ? fNonInitiator.adoptionDates.get(childId) : null;
        const marriedAt = fInitiator.marriedAt || new Date(0);
        if (adoptedByInitiatorDate && adoptedByInitiatorDate < marriedAt) {
          fNonInitiator.children = fNonInitiator.children.filter(c => c !== childId);
          childFamily.parents = childFamily.parents.filter(p => p !== nonInitiator);
        } else if (adoptedByNonInitiatorDate && adoptedByNonInitiatorDate < marriedAt) {
          fInitiator.children = fInitiator.children.filter(c => c !== childId);
          childFamily.parents = childFamily.parents.filter(p => p !== initiator);
        } else {
          hasChildAdoptedDuringMarriage = true;
          fInitiator.children = fInitiator.children.filter(c => c !== childId);
          childFamily.parents = childFamily.parents.filter(p => p !== initiator);
        }
        await childFamily.save();
      }
      f1.spouse = null;
      f2.spouse = null;
      f1.proposedBy = null;
      f2.proposedBy = null;
      f1.marriedAt = null;
      f2.marriedAt = null;
      f1.forcedSpouse = false;
      f2.forcedSpouse = false;
      if (!f1.ex_partners.includes(user2)) f1.ex_partners.push(user2);
      if (!f2.ex_partners.includes(user1)) f2.ex_partners.push(user1);
      await f1.save();
      await f2.save();
      return {
        status: 'divorced',
        hasChildAdoptedDuringMarriage,
        initiator,
        nonInitiator
      };
    } else {
      this.pendingDivorces.set(divorceKey1, {
        requesterId: user1,
        timestamp: Date.now()
      });
      setTimeout(() => {
        this.pendingDivorces.delete(divorceKey1);
      }, 120000);
      return {
        status: 'requested'
      };
    }
  }
  async forceDivorce(user1, user2) {
    const f1 = await this.getFamily(user1);
    const f2 = await this.getFamily(user2);
    if (f1.spouse !== user2 || f2.spouse !== user1) return 'not_married';
    f1.spouse = null;
    f2.spouse = null;
    f1.proposedBy = null;
    f2.proposedBy = null;
    f1.forcedSpouse = false;
    f2.forcedSpouse = false;
    if (!f1.ex_partners.includes(user2)) f1.ex_partners.push(user2);
    if (!f2.ex_partners.includes(user1)) f2.ex_partners.push(user1);
    await f1.save();
    await f2.save();
    return 'divorced';
  }
  async adopt(requester, child) {
    const rFamily = await this.getFamily(requester);
    const cFamily = await this.getFamily(child);
    if (rFamily.parents.includes(child)) return {
      status: 'is_parent'
    };
    if (cFamily.parents.length > 0 && !cFamily.parents.includes(requester) && !cFamily.parents.includes(rFamily.spouse)) {
      return {
        status: 'already_adopted_by_others'
      };
    }
    if (rFamily.children.includes(child)) return {
      status: 'already_adopted'
    };
    if (rFamily.spouse) {
      const spouseFamily = await this.getFamily(rFamily.spouse);
      const step2Key = `adopt-step2-${rFamily.spouse}-${child}`;
      if (this.pendingProposals.has(step2Key)) {
        this.pendingProposals.delete(step2Key);
        rFamily.children.push(child);
        rFamily.adoptionDates.set(child, new Date());
        spouseFamily.children.push(child);
        spouseFamily.adoptionDates.set(child, new Date());
        cFamily.parents.push(requester);
        if (!cFamily.parents.includes(rFamily.spouse)) {
          cFamily.parents.push(rFamily.spouse);
        }
        rFamily.disowned = rFamily.disowned.filter(c => c !== child);
        spouseFamily.disowned = spouseFamily.disowned.filter(c => c !== child);
        cFamily.disowned = cFamily.disowned.filter(p => p !== requester && p !== rFamily.spouse);
        await rFamily.save();
        await spouseFamily.save();
        await cFamily.save();
        return {
          status: 'adopted_by_couple',
          parent1: rFamily.spouse,
          parent2: requester
        };
      }
    }
    const checkKey = `propose-child-${child}-parent-${requester}`;
    if (this.hasValidProposal(checkKey)) {
      this.pendingProposals.delete(checkKey);
      if (rFamily.spouse) {
        const step2Key = `adopt-step2-${requester}-${child}`;
        this.pendingProposals.set(step2Key, Date.now());
        return {
          status: 'waiting_spouse',
          spouse: rFamily.spouse
        };
      } else {
        rFamily.children.push(child);
        rFamily.adoptionDates.set(child, new Date());
        cFamily.parents.push(requester);
        rFamily.disowned = rFamily.disowned.filter(c => c !== child);
        cFamily.disowned = cFamily.disowned.filter(p => p !== requester);
        rFamily.ranAway = (rFamily.ranAway || []).filter(c => c !== child);
        await rFamily.save();
        await cFamily.save();
        return {
          status: 'adopted'
        };
      }
    } else {
      const setKey = `propose-parent-${requester}-child-${child}`;
      this.pendingProposals.set(setKey, Date.now());
      return {
        status: 'proposed'
      };
    }
  }
  async forceAdopt(parent, child) {
    const pFamily = await this.getFamily(parent);
    const cFamily = await this.getFamily(child);
    if (pFamily.children.includes(child) || cFamily.parents.includes(parent)) return 'already_adopted';
    pFamily.children.push(child);
    cFamily.parents.push(parent);
    pFamily.disowned = pFamily.disowned.filter(c => c !== child);
    cFamily.disowned = cFamily.disowned.filter(p => p !== parent);
    pFamily.ranAway = (pFamily.ranAway || []).filter(c => c !== child);
    if (!pFamily.forcedChildren) pFamily.forcedChildren = [];
    if (!cFamily.forcedParents) cFamily.forcedParents = [];
    if (!pFamily.forcedChildren.includes(child)) pFamily.forcedChildren.push(child);
    if (!cFamily.forcedParents.includes(parent)) cFamily.forcedParents.push(parent);
    await pFamily.save();
    await cFamily.save();
    return 'adopted';
  }
  async disown(parent, child, isForce = false) {
    const pFamily = await this.getFamily(parent);
    const cFamily = await this.getFamily(child);
    if (!pFamily.children.includes(child) || !cFamily.parents.includes(parent)) return false;
    if (!isForce) {
      if (pFamily.forcedChildren && pFamily.forcedChildren.includes(child) || cFamily.forcedParents && cFamily.forcedParents.includes(parent)) {
        return 'forced_relationship';
      }
    }
    pFamily.children = pFamily.children.filter(c => c !== child);
    cFamily.parents = cFamily.parents.filter(p => p !== parent);
    if (!pFamily.disowned.includes(child)) pFamily.disowned.push(child);
    if (!cFamily.disowned.includes(parent)) cFamily.disowned.push(parent);
    pFamily.forcedChildren = (pFamily.forcedChildren || []).filter(c => c !== child);
    cFamily.forcedParents = (cFamily.forcedParents || []).filter(p => p !== parent);
    await pFamily.save();
    await cFamily.save();
    return true;
  }
  async makeparent(child, requester) {
    const rFamily = await this.getFamily(requester);
    const cFamily = await this.getFamily(child);
    if (cFamily.children.includes(requester)) return {
      status: 'is_parent'
    };
    if (cFamily.parents.length > 0) return {
      status: 'already_adopted_by_others'
    };
    if (rFamily.children.includes(child)) return {
      status: 'already_adopted'
    };
    const checkKey = `propose-parent-${requester}-child-${child}`;
    if (this.hasValidProposal(checkKey)) {
      this.pendingProposals.delete(checkKey);
      if (rFamily.spouse) {
        const step2Key = `adopt-step2-${requester}-${child}`;
        this.pendingProposals.set(step2Key, Date.now());
        return {
          status: 'waiting_spouse',
          spouse: rFamily.spouse
        };
      } else {
        rFamily.children.push(child);
        rFamily.adoptionDates.set(child, new Date());
        cFamily.parents.push(requester);
        rFamily.disowned = rFamily.disowned.filter(c => c !== child);
        cFamily.disowned = cFamily.disowned.filter(p => p !== requester);
        rFamily.ranAway = (rFamily.ranAway || []).filter(c => c !== child);
        await rFamily.save();
        await cFamily.save();
        return {
          status: 'adopted'
        };
      }
    } else {
      const setKey = `propose-child-${child}-parent-${requester}`;
      this.pendingProposals.set(setKey, Date.now());
      return {
        status: 'proposed'
      };
    }
  }
  async emancipate(child, parent, isForce = false) {
    const pFamily = await this.getFamily(parent);
    const cFamily = await this.getFamily(child);
    if (!pFamily.children.includes(child) || !cFamily.parents.includes(parent)) return false;
    if (!isForce) {
      if (cFamily.forcedParents && cFamily.forcedParents.includes(parent) || pFamily.forcedChildren && pFamily.forcedChildren.includes(child)) {
        return 'forced_relationship';
      }
    }
    pFamily.children = pFamily.children.filter(c => c !== child);
    cFamily.parents = cFamily.parents.filter(p => p !== parent);
    if (!pFamily.ranAway) pFamily.ranAway = [];
    if (!pFamily.ranAway.includes(child)) pFamily.ranAway.push(child);
    if (!pFamily.disowned.includes(child)) pFamily.disowned.push(child);
    if (!cFamily.disowned.includes(parent)) cFamily.disowned.push(parent);
    pFamily.forcedChildren = (pFamily.forcedChildren || []).filter(c => c !== child);
    cFamily.forcedParents = (cFamily.forcedParents || []).filter(p => p !== parent);
    await pFamily.save();
    await cFamily.save();
    return true;
  }
  async resolveTaxPayers(userId) {
    const {
      FATHER
    } = require('../config');
    const fatherId = FATHER[0];
    if (FATHER.includes(userId)) return [];
    const family = await this.getFamily(userId);
    if (family.parents.some(p => FATHER.includes(p))) return [];
    if (family.marriedToCelestia) return [];
    for (const parentId of family.parents) {
      const parentFamily = await this.getFamily(parentId);
      if (parentFamily.parents.length > 0) {
        return [{
          userId: parentId,
          share: 1.0
        }];
      }
    }
    for (const childId of family.children) {
      const childFamily = await this.getFamily(childId);
      if (childFamily.children.length > 0) {
        return [{
          userId: childId,
          share: 1.0
        }];
      }
    }
    if (family.parents.length > 0 && !family.spouse && family.children.length === 0) {
      if (family.parents.length === 1) {
        return [{
          userId: family.parents[0],
          share: 1.0
        }];
      } else {
        return family.parents.map(p => ({
          userId: p,
          share: 0.5
        }));
      }
    }
    if (family.spouse && family.proposedBy && family.proposedBy !== userId) {
      return [{
        userId: family.proposedBy,
        share: 1.0
      }];
    }
    return [{
      userId,
      share: 1.0
    }];
  }
  async calculatePocketMoney(parentId, earningAmount) {
    const family = await this.getFamily(parentId);
    const results = [];
    for (const childId of family.children) {
      if (family.ranAway && family.ranAway.includes(childId)) continue;
      const childFamily = await this.getFamily(childId);
      const parentCount = childFamily.parents.length;
      const rate = parentCount >= 2 ? 0.005 : 0.01;
      const amount = Math.floor(earningAmount * rate);
      if (amount > 0) {
        results.push({
          childId,
          amount
        });
      }
    }
    return results;
  }
  async getFamilyTree(userId, visited = new Set(), depth = 0) {
    if (depth > 5) return null;
    if (visited.has(userId)) return null;
    visited.add(userId);
    const family = await this.getFamily(userId);
    let tree = {
      id: userId,
      spouse: family.spouse,
      parents: family.parents,
      children: []
    };
    for (const childId of family.children) {
      const childTree = await this.getFamilyTree(childId, visited, depth + 1);
      if (childTree) {
        tree.children.push(childTree);
      } else {
        tree.children.push({
          id: childId,
          spouse: null,
          parents: [userId],
          children: []
        });
      }
    }
    return tree;
  }
  async getFamilySize(userId, visited = new Set()) {
    if (visited.has(userId)) return 0;
    visited.add(userId);
    const family = await this.getFamily(userId);
    let size = 1;
    if (family.spouse && !visited.has(family.spouse)) {
      size += await this.getFamilySize(family.spouse, visited);
    }
    for (const parentId of family.parents) {
      if (!visited.has(parentId)) {
        size += await this.getFamilySize(parentId, visited);
      }
    }
    for (const childId of family.children) {
      if (!visited.has(childId)) {
        size += await this.getFamilySize(childId, visited);
      }
    }
    return size;
  }
  setCelestiaMarryRequest(groupId, senderId) {
    this.celestiaMarryRequests.set(groupId, {
      senderId,
      timestamp: Date.now()
    });
  }
  getCelestiaMarryRequest(groupId) {
    const req = this.celestiaMarryRequests.get(groupId);
    if (!req) return null;
    if (Date.now() - req.timestamp > 120000) {
      this.celestiaMarryRequests.delete(groupId);
      return null;
    }
    return req;
  }
  clearCelestiaMarryRequest(groupId) {
    this.celestiaMarryRequests.delete(groupId);
  }
}
module.exports = new FamilyStore();