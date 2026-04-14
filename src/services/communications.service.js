import { api } from '../lib/api';

export const CommunicationsService = {
  // --- AUTO NOTIFICATION RULES ---
  listAutoNotificationRules: async (params = {}) => {
    const res = await api.get('/ext-api/AutoNotificationRuleList', { params });
    return res.data;
  },
  createAutoNotificationRule: async (data) => {
    const res = await api.post('/ext-api/AutoNotificationRuleCreate', data);
    return res.data;
  },
  updateAutoNotificationRule: async (data) => {
    const res = await api.post('/ext-api/AutoNotificationRuleUpdate', data);
    return res.data;
  },
  deleteAutoNotificationRule: async (ruleId) => {
    const res = await api.get('/ext-api/AutoNotificationRuleDelete', { params: { rule_id: ruleId } });
    return res.data;
  },

  // --- EMAIL CAMPAIGNS ---
  listEmailCampaigns: async (params = {}) => {
    const res = await api.get('/ext-api/EmailCampaignList', { params });
    return res.data;
  },
  createEmailCampaign: async (data) => {
    const res = await api.post('/ext-api/EmailCampaignCreate', data);
    return res.data;
  },
  sendEmailCampaign: async (campaignId) => {
    const res = await api.get('/ext-api/EmailCampaignSend', { params: { campaign_id: campaignId } });
    return res.data;
  },
  getEmailCampaignStats: async (campaignId) => {
    const res = await api.get('/ext-api/EmailCampaignStats', { params: { campaign_id: campaignId } });
    return res.data;
  },

  // --- MESSAGE CENTER ---
  listMessages: async (params = {}) => {
    const res = await api.get('/ext-api/MessageCenterList', { params });
    return res.data;
  },
  markMessageRead: async (messageId) => {
    const res = await api.get('/ext-api/MessageCenterMarkRead', { params: { message_id: messageId } });
    return res.data;
  },
  sendMessage: async (data) => {
    const res = await api.post('/ext-api/MessageCenterSend', data);
    return res.data;
  },

  // --- PUSH NOTIFICATIONS ---
  sendPushNotification: async (data) => {
    const res = await api.post('/ext-api/PushNotificationSend', data);
    return res.data;
  },
  sendPushNotificationBulk: async (data) => {
    const res = await api.post('/ext-api/PushNotificationSendBulk', data);
    return res.data;
  },

  // --- SMS ---
  sendSMS: async (params) => {
    const res = await api.get('/ext-api/SMSSend', { params });
    return res.data;
  },
  createSMSTemplate: async (data) => {
    const res = await api.post('/ext-api/SMSTemplateCreate', data);
    return res.data;
  },
  listSMSTemplates: async (params = {}) => {
    const res = await api.get('/ext-api/SMSTemplateList', { params });
    return res.data;
  },
};
