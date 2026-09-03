// =========================================================
// Taf3el - Database Layer (Supabase)
// =========================================================
const SUPABASE_URL = "https://lgndbrakixptfluiorcv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_EXVBeYA-CYT8j0OTBnww_Q_v8M70JDU";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// بنحول رقم التليفون لإيميل وهمي عشان نستخدم نظام تسجيل الدخول بتاع Supabase
function phoneToEmail(phone) {
  return `${phone.replace(/\D/g, "")}@taf3el.users`;
}

// تحقق صارم من صيغة رقم التليفون المصري: 11 رقم بالظبط، وبادئة 010/011/012/015
const EGYPT_PHONE_REGEX = /^01[0125][0-9]{8}$/;
function isValidEgyptPhone(phone) {
  return EGYPT_PHONE_REGEX.test((phone || "").trim());
}

const db = {
  async signUp(name, phone, password, referralCodeUsed, username) {
    const email = phoneToEmail(phone);
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    const userId = data.user.id;
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert({ id: userId, phone, name, referral_code: referralCode, username: username ? username.trim() : null });
    if (profileError) throw profileError;
    if (referralCodeUsed) {
      try { await supabaseClient.rpc("apply_referral_code", { p_code: referralCodeUsed }); } catch (e) { /* ignore invalid code */ }
    }
    return await this.fetchProfile(userId);
  },

  async isUsernameTaken(username) {
    const { data, error } = await supabaseClient.rpc("is_username_taken", { p_username: username });
    if (error) throw error;
    return !!data;
  },

  async signIn(identifier, password) {
    let phone = identifier;
    const { data: resolved, error: resolveError } = await supabaseClient.rpc("resolve_login_identifier", { p_identifier: identifier });
    if (!resolveError && resolved) phone = resolved;
    const email = phoneToEmail(phone);
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw new Error("بيانات الدخول غير صحيحة");
    return await this.fetchProfile(data.user.id);
  },

  async updateMyProfile({ name, phone, username }) {
    const { data, error } = await supabaseClient.rpc("update_my_profile", {
      p_name: name || null, p_phone: phone || null, p_username: username || null
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async signOut() {
    await supabaseClient.auth.signOut();
  },

  ALLOWED_AVATAR_TYPES: ["image/png", "image/jpeg", "image/webp"],
  MAX_AVATAR_SIZE_BYTES: 5 * 1024 * 1024, // 5MB

  async uploadAvatar(userId, file) {
    if (!this.ALLOWED_AVATAR_TYPES.includes(file.type)) {
      throw new Error("الصورة لازم تكون PNG أو JPEG أو WEBP");
    }
    if (file.size > this.MAX_AVATAR_SIZE_BYTES) {
      throw new Error("حجم الصورة أكبر من المسموح (5 ميجا)");
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabaseClient.storage.from("avatars").upload(path, file, {
      contentType: file.type,
      upsert: true
    });
    if (error) throw error;
    const { data } = supabaseClient.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  },

  async updateMyAvatar(avatarUrl) {
    const { data, error } = await supabaseClient.rpc("update_my_avatar", {
      p_avatar_url: avatarUrl
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async changeMyPassword(phone, currentPassword, newPassword) {
    const email = phoneToEmail(phone);
    const { error: verifyError } = await supabaseClient.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) throw new Error("كلمة المرور الحالية غير صحيحة");
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async adminResetUserPassword(userId, newPassword) {
    const { error } = await supabaseClient.rpc("admin_reset_user_password", {
      p_user_id: userId, p_new_password: newPassword
    });
    if (error) throw error;
  },

  async getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  },

  async fetchProfile(userId) {
    const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
  },

  async placeOrder(order) {
    const { data, error } = await supabaseClient.rpc("place_order", {
      p_service_id: order.serviceId,
      p_content_link: order.contentLink,
      p_quantity: order.quantity,
      p_notes: order.notes,
      p_discount_code: order.discountCode || null,
      p_points_used: order.pointsUsed || 0
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async fetchMyOrders(userId) {
    const { data, error } = await supabaseClient.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async fetchAllOrders() {
    const { data, error } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async adminSetOrderStatus(orderId, status) {
    const { error } = await supabaseClient.rpc("admin_set_order_status", { p_order_id: orderId, p_status: status });
    if (error) throw error;
  },
  async adminCompleteOrder(orderId) {
    const { error } = await supabaseClient.rpc("admin_complete_order", { p_order_id: orderId });
    if (error) throw error;
  },
  async adminCancelOrder(orderId) {
    const { error } = await supabaseClient.rpc("admin_cancel_order", { p_order_id: orderId });
    if (error) throw error;
  },
  async adminDeleteOrder(orderId) {
    const { error } = await supabaseClient.rpc("admin_delete_order", { p_order_id: orderId });
    if (error) throw error;
  },

  ALLOWED_PROOF_TYPES: ["image/png", "image/jpeg", "image/webp"],
  MAX_PROOF_SIZE_BYTES: 5 * 1024 * 1024, // 5MB

  async uploadPaymentProof(userId, file) {
    if (!this.ALLOWED_PROOF_TYPES.includes(file.type)) {
      throw new Error("الصورة لازم تكون PNG أو JPEG أو WEBP");
    }
    if (file.size > this.MAX_PROOF_SIZE_BYTES) {
      throw new Error("حجم الصورة أكبر من المسموح (5 ميجا)");
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage.from("payment-proofs").upload(path, file, {
      contentType: file.type
    });
    if (error) throw error;
    return path;
  },

  async getPaymentProofSignedUrl(path, expiresInSeconds = 300) {
    const { data, error } = await supabaseClient.storage
      .from("payment-proofs")
      .createSignedUrl(path, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  },

  async createBalanceRequest(req) {
    const { data, error } = await supabaseClient.rpc("create_balance_request", {
      p_amount: req.amount, p_payment_method: req.paymentMethod,
      p_transaction_id: req.transactionId, p_transfer_to: req.transferTo,
      p_proof_url: req.proofUrl || null
    });
    if (error) throw error;
    return data;
  },
  async fetchAllBalanceRequests() {
    const { data, error } = await supabaseClient.from("balance_requests").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async adminApproveBalanceRequest(id) {
    const { error } = await supabaseClient.rpc("admin_approve_balance_request", { p_request_id: id });
    if (error) throw error;
  },
  async adminRejectBalanceRequest(id) {
    const { error } = await supabaseClient.rpc("admin_reject_balance_request", { p_request_id: id });
    if (error) throw error;
  },
  async adminDeleteBalanceRequest(id) {
    const { error } = await supabaseClient.rpc("admin_delete_balance_request", { p_request_id: id });
    if (error) throw error;
  },
  async adminAddBalance(userId, amount) {
    const { error } = await supabaseClient.rpc("admin_add_balance", { p_user_id: userId, p_amount: amount });
    if (error) throw error;
  },
  async adminDeductBalance(userId, amount) {
    const { error } = await supabaseClient.rpc("admin_deduct_balance", { p_user_id: userId, p_amount: amount });
    if (error) throw error;
  },

  async createMessage(subject, content) {
    const { data, error } = await supabaseClient.rpc("create_message", { p_subject: subject, p_content: content });
    if (error) throw error;
    return data;
  },
  async fetchMyMessages(userId) {
    const { data, error } = await supabaseClient.from("messages").select("*, message_replies(*), message_client_replies(*)").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async fetchAllMessages() {
    const { data, error } = await supabaseClient.from("messages").select("*, message_replies(*), message_client_replies(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async clientReplyMessage(messageId, content) {
    const { error } = await supabaseClient.rpc("client_reply_message", { p_message_id: messageId, p_content: content });
    if (error) throw error;
  },
  async adminReplyMessage(messageId, content) {
    const { error } = await supabaseClient.rpc("admin_reply_message", { p_message_id: messageId, p_content: content });
    if (error) throw error;
  },
  async adminSetMessageStatus(messageId, status) {
    const { error } = await supabaseClient.from("messages").update({ status }).eq("id", messageId);
    if (error) throw error;
  },
  async adminResolveMessage(messageId, content) {
    const { error } = await supabaseClient.rpc("admin_resolve_message", { p_message_id: messageId, p_content: content });
    if (error) throw error;
  },
  async adminDeleteMessage(messageId) {
    const { error } = await supabaseClient.rpc("admin_delete_message", { p_message_id: messageId });
    if (error) throw error;
  },

  async fetchAllCustomers() {
    const { data, error } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async adminSetBlockStatus(userId, blocked) {
    const { error } = await supabaseClient.rpc("admin_set_block_status", { p_user_id: userId, p_blocked: blocked });
    if (error) throw error;
  },
  async adminDeleteCustomer(userId) {
    const { error } = await supabaseClient.rpc("admin_delete_customer", { p_user_id: userId });
    if (error) throw error;
  },

  async fetchServiceCosts() {
    const { data, error } = await supabaseClient.from("service_costs").select("*");
    if (error) throw error;
    const map = {};
    (data || []).forEach(r => map[r.service_key] = r.cost);
    return map;
  },
  async adminSaveServiceCost(key, cost) {
    const { error } = await supabaseClient.rpc("admin_save_service_cost", { p_key: key, p_cost: cost });
    if (error) throw error;
  },
  async fetchProfitHistory() {
    const { data, error } = await supabaseClient.from("profit_history").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async claimAdPoints() {
    const { data, error } = await supabaseClient.rpc("claim_ad_points");
    if (error) throw new Error(error.message);
    return data;
  },

  async fetchSpendingLeaderboard() {
    const { data, error } = await supabaseClient.rpc("get_spending_leaderboard");
    if (error) throw error;
    return data;
  },
  async fetchReferralLeaderboard() {
    const { data, error } = await supabaseClient.rpc("get_referral_leaderboard");
    if (error) throw error;
    return data;
  },
  async fetchCompletedTodayCount() {
    const { data, error } = await supabaseClient.rpc("get_completed_today_count");
    if (error) throw error;
    return data;
  },
  async fetchTotalOrdersCount() {
    const { data, error } = await supabaseClient.rpc("get_total_orders_count");
    if (error) throw error;
    return data;
  },
  async fetchTotalCustomersCount() {
    const { data, error } = await supabaseClient.rpc("get_total_customers_count");
    if (error) throw error;
    return data;
  },

  async fetchFaqs() {
    const { data, error } = await supabaseClient.from("faqs").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },
  async adminAddFaq(question, keywords, answer) {
    const { error } = await supabaseClient.rpc("admin_add_faq", { p_question: question, p_keywords: keywords, p_answer: answer });
    if (error) throw error;
  },
  async adminUpdateFaq(id, question, keywords, answer) {
    const { error } = await supabaseClient.rpc("admin_update_faq", { p_id: id, p_question: question, p_keywords: keywords, p_answer: answer });
    if (error) throw error;
  },
  async adminDeleteFaq(id) {
    const { error } = await supabaseClient.rpc("admin_delete_faq", { p_id: id });
    if (error) throw error;
  },

  async validateDiscountCode(code, serviceId) {
    const { data, error } = await supabaseClient.rpc("validate_discount_code", { p_code: code, p_service_id: serviceId });
    if (error) throw error;
    return data;
  },
  async fetchDiscountCodes() {
    const { data, error } = await supabaseClient.from("discount_codes").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async adminGenerateDiscountCode(percentage, serviceKeys, expiresAt) {
    const { data, error } = await supabaseClient.rpc("admin_generate_discount_code", { p_percentage: percentage, p_service_keys: serviceKeys, p_expires_at: expiresAt });
    if (error) throw error;
    return data;
  },
  async adminCancelDiscountCode(id) {
    const { error } = await supabaseClient.rpc("admin_cancel_discount_code", { p_id: id });
    if (error) throw error;
  },
  async adminDeleteDiscountCode(id) {
    const { error } = await supabaseClient.rpc("admin_delete_discount_code", { p_id: id });
    if (error) throw error;
  },

  async fetchCurrencyRates() {
    const { data, error } = await supabaseClient.from("currency_rates").select("*");
    if (error) throw error;
    return data;
  },
  async adminSetCurrencyRate(currencyCode, ratePerEgp) {
    const { error } = await supabaseClient.rpc("admin_set_currency_rate", { p_currency: currencyCode, p_rate: ratePerEgp });
    if (error) throw error;
  },

  async heartbeatPresence(sessionId) {
    try { await supabaseClient.rpc("heartbeat_presence", { p_session_id: sessionId }); } catch (e) { /* ignore */ }
  },
  async fetchOnlineUsersCount() {
    const { data, error } = await supabaseClient.rpc("get_online_users_count");
    if (error) throw error;
    return data;
  },

  async adminStartConversation(userId, subject, content) {
    const { data, error } = await supabaseClient.rpc("admin_start_conversation", {
      p_user_id: userId, p_subject: subject, p_content: content
    });
    if (error) throw error;
    return data;
  },

  async fetchReferralStats() {
    const { data, error } = await supabaseClient.rpc("get_my_referral_stats");
    if (error) throw error;
    return data;
  },
  async fetchReferralFriends() {
    const { data, error } = await supabaseClient.rpc("get_my_referral_friends");
    if (error) throw error;
    return data;
  },
  async fetchReferralEarnings() {
    const { data, error } = await supabaseClient.rpc("get_my_referral_earnings");
    if (error) throw error;
    return data;
  },
  async fetchReferralTiers() {
    const { data, error } = await supabaseClient.from("referral_tier_config").select("*").order("min_activated_friends", { ascending: true });
    if (error) throw error;
    return data;
  },
  async adminSetReferralTier(minFriends, ratePercent) {
    const { error } = await supabaseClient.rpc("admin_set_referral_tier", { p_min_friends: minFriends, p_rate_percent: ratePercent });
    if (error) throw error;
  },
  async adminDeleteReferralTier(minFriends) {
    const { error } = await supabaseClient.rpc("admin_delete_referral_tier", { p_min_friends: minFriends });
    if (error) throw error;
  },

  async fetchServicePoints() {
    const { data, error } = await supabaseClient.from("service_points").select("*");
    if (error) throw error;
    const map = {};
    (data || []).forEach(r => map[r.service_key] = r.points_value);
    return map;
  },
  async adminSaveServicePoints(key, points) {
    const { error } = await supabaseClient.rpc("admin_save_service_points", { p_key: key, p_points: points });
    if (error) throw error;
  },
  async fetchPointValue() {
    const { data, error } = await supabaseClient.from("app_settings").select("value").eq("key", "point_value_egp").single();
    if (error) throw error;
    return parseFloat(data.value);
  },
  async adminSetPointValue(value) {
    const { error } = await supabaseClient.rpc("admin_set_point_value", { p_value: value });
    if (error) throw error;
  }
};

window.db = db;
