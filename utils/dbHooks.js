const mongoose = require('mongoose');
const { getPhoneFromLid } = require('./getUserId');
async function resolveWhatsAppUserId(userId) {
  if (!userId) return userId;
  
  const cachedPhone = getPhoneFromLid(userId);
  if (cachedPhone) return cachedPhone;
  
  try {
    const LinkedAccount = mongoose.model('LinkedAccount');
    const linked = await LinkedAccount.findOne({
      $or: [{
        whatsappId: userId
      }, {
        unifiedId: userId
      }]
    });
    if (linked) return linked.unifiedId;
  } catch (e) {}
  return userId;
}
function registerUnifiedIdHooks(schema) {
  const queryMethods = ['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'countDocuments'];
  for (const method of queryMethods) {
    schema.pre(method, async function () {
      const filter = this.getQuery();
      if (filter) {
        if (typeof filter.userId === 'string') {
          filter.userId = await resolveWhatsAppUserId(filter.userId);
        } else if (filter.userId && typeof filter.userId === 'object') {
          if (filter.userId.$in && Array.isArray(filter.userId.$in)) {
            filter.userId.$in = await Promise.all(filter.userId.$in.map(id => resolveWhatsAppUserId(id)));
          } else if (filter.userId.$eq) {
            filter.userId.$eq = await resolveWhatsAppUserId(filter.userId.$eq);
          } else if (filter.userId.$ne) {
            filter.userId.$ne = await resolveWhatsAppUserId(filter.userId.$ne);
          }
        }
        if (typeof filter.sellerId === 'string') {
          filter.sellerId = await resolveWhatsAppUserId(filter.sellerId);
        }
        if (typeof filter.buyerId === 'string') {
          filter.buyerId = await resolveWhatsAppUserId(filter.buyerId);
        }
      }
    });
  }
  schema.pre('save', async function () {
    if (typeof this.userId === 'string') {
      this.userId = await resolveWhatsAppUserId(this.userId);
    }
    if (typeof this.sellerId === 'string') {
      this.sellerId = await resolveWhatsAppUserId(this.sellerId);
    }
    if (typeof this.buyerId === 'string') {
      this.buyerId = await resolveWhatsAppUserId(this.buyerId);
    }
  });
}
module.exports = {
  resolveWhatsAppUserId,
  registerUnifiedIdHooks
};