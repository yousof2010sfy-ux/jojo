// =========================================================
// Refresh - Profile Page Logic (profile.js)
// =========================================================

let editUsernameCheckTimeout = null;
let editUsernameCheckToken = 0;
let editUsernameCheckState = null;

function setEditUsernameCheckStatus(state, message) {
    editUsernameCheckState = state;
    const el = document.getElementById('editUsernameCheckStatus');
    if (el) {
        const colorClass = {
            checking: 'text-yellow-400', available: 'text-green-400', unchanged: 'text-slate-400',
            taken: 'text-red-400', invalid: 'text-slate-400', error: 'text-yellow-400'
        }[state] || 'text-slate-400';
        el.className = 'text-xs mt-1 ' + colorClass;
        el.textContent = message || '';
    }
    const btn = document.getElementById('editProfileSubmitBtn');
    if (btn) btn.disabled = !(state === 'available' || state === 'unchanged' || state === null);
}

function handleEditUsernameInput() {
    const usernameInput = document.getElementById('editProfileUsername');
    if (!usernameInput) return;
    const username = usernameInput.value.trim();
    clearTimeout(editUsernameCheckTimeout);
    editUsernameCheckToken++;
    const myToken = editUsernameCheckToken;

    if (!username) {
        setEditUsernameCheckStatus(null, '');
        return;
    }

    if (window.currentUser && username.toLowerCase() === (window.currentUser.username || '').toLowerCase()) {
        setEditUsernameCheckStatus('unchanged', '');
        return;
    }

    const issues = getUsernameFormatIssues(username);
    if (issues.length > 0) {
        const separator = window.currentLang === 'ar' ? '، ' : ', ';
        setEditUsernameCheckStatus('invalid', t('username_missing_prefix') + issues.join(separator));
        return;
    }

    setEditUsernameCheckStatus('checking', t('username_checking'));

    editUsernameCheckTimeout = setTimeout(async () => {
        try {
            const taken = await window.db.isUsernameTaken(username);
            if (myToken !== editUsernameCheckToken) return;
            setEditUsernameCheckStatus(taken ? 'taken' : 'available', taken ? t('username_taken') : t('username_available'));
        } catch (err) {
            if (myToken !== editUsernameCheckToken) return;
            setEditUsernameCheckStatus('error', t('username_check_error'));
        }
    }, 450);
}

function populateProfileData() {
    const authReq = document.getElementById('profileAuthRequired');
    const profileContent = document.getElementById('profileMainContent');

    if (!window.currentUser) {
        if (authReq) authReq.classList.remove('hidden');
        if (profileContent) profileContent.classList.add('hidden');
        return;
    }

    if (authReq) authReq.classList.add('hidden');
    if (profileContent) profileContent.classList.remove('hidden');

    const wrapper = document.getElementById('profileAvatarWrapper');
    if (wrapper) {
        wrapper.innerHTML = avatarCircleHtml(window.currentUser.name, window.currentUser.avatarUrl, 'w-24 h-24 text-3xl mx-auto');
    }

    const nameInput = document.getElementById('editProfileName');
    if (nameInput) nameInput.value = window.currentUser.name || '';

    const phoneInput = document.getElementById('editProfilePhone');
    if (phoneInput) phoneInput.value = window.currentUser.phone || '';

    const usernameInput = document.getElementById('editProfileUsername');
    if (usernameInput) usernameInput.value = window.currentUser.username || '';

    setEditUsernameCheckStatus('unchanged', '');
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    if (!window.currentUser) return;

    const name = document.getElementById('editProfileName').value.trim();
    const phone = document.getElementById('editProfilePhone').value.trim();
    const username = document.getElementById('editProfileUsername').value.trim();

    if (!name) { showNotification(td('لازم تكتب الاسم'), 'error'); return; }
    if (!isValidEgyptPhone(phone)) {
        showNotification(td('رقم التليفون لازم يكون 11 رقم ويبدأ بـ 01'), 'error');
        return;
    }
    if (!USERNAME_FULL_REGEX.test(username)) {
        showNotification(td('اليوزر نيم لازم يكون من 3 لـ 20 خانة، ويحتوي على حرف ورقم على الأقل'), 'error');
        return;
    }
    if (editUsernameCheckState !== 'available' && editUsernameCheckState !== 'unchanged') {
        showNotification(td('لازم تستنى نتيجة التحقق من اليوزر نيم الأول'), 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
        const updated = mapProfile(await window.db.updateMyProfile({ name, phone, username }));
        window.currentUser = { ...window.currentUser, ...updated };
        updateHeaderAvatar();
        showNotification(td('تم حفظ التعديلات بنجاح'), 'success');
        populateProfileData();
    } catch (err) {
        showNotification(td(err.message) || td('حصل خطأ، حاول تاني'), 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleAvatarFileChange(e) {
    const file = e.target.files[0];
    if (!file || !window.currentUser) return;

    const wrapper = document.getElementById('profileAvatarWrapper');
    const btn = document.getElementById('changeAvatarBtn');

    const previewUrl = URL.createObjectURL(file);
    if (wrapper) {
        wrapper.innerHTML = `<img src="${previewUrl}" alt="${esc(window.currentUser.name || '')}" class="w-24 h-24 text-3xl mx-auto rounded-full object-cover" style="border:1px solid var(--border-color-soft);">`;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = td('⏳ جاري الرفع...');
    }

    try {
        const publicUrl = await window.db.uploadAvatar(window.currentUser.id, file);
        const updated = mapProfile(await window.db.updateMyAvatar(publicUrl));
        window.currentUser = { ...window.currentUser, ...updated };
        if (wrapper) {
            wrapper.innerHTML = avatarCircleHtml(window.currentUser.name, window.currentUser.avatarUrl, 'w-24 h-24 text-3xl mx-auto');
        }
        updateHeaderAvatar();
        showNotification(td('تم تحديث صورة البروفايل بنجاح'), 'success');
    } catch (err) {
        if (wrapper) {
            wrapper.innerHTML = avatarCircleHtml(window.currentUser.name, window.currentUser.avatarUrl, 'w-24 h-24 text-3xl mx-auto');
        }
        showNotification(td(err.message) || td('حصل خطأ أثناء رفع الصورة، حاول تاني'), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = td('📷 تغيير الصورة');
        }
        URL.revokeObjectURL(previewUrl);
        e.target.value = '';
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    if (!window.currentUser) return;

    const current = document.getElementById('currentPasswordInput').value;
    const newPass = document.getElementById('newPasswordInput').value;
    const confirmPass = document.getElementById('confirmNewPasswordInput').value;

    if (newPass !== confirmPass) {
        showNotification(td('كلمة المرور الجديدة وتأكيدها مش متطابقين'), 'error');
        return;
    }
    if (newPass.length < 6 || newPass.length > 15) {
        showNotification(td('كلمة المرور الجديدة لازم تكون من 6 لـ 15 حرف/رقم'), 'error');
        return;
    }
    const changeStrength = calculatePasswordStrength(newPass);
    if (changeStrength !== 'good' && changeStrength !== 'very_strong') {
        showNotification(td('كلمة المرور الجديدة لازم تكون على الأقل "كويس" أو "قوي جدًا" حسب مؤشر القوة'), 'error');
        return;
    }

    try {
        await window.db.changeMyPassword(window.currentUser.phone, current, newPass);
        showNotification(td('تم تغيير كلمة المرور بنجاح'), 'success');
        document.getElementById('changePasswordForm').reset();
        resetPasswordStrengthMeter('newPasswordStrength');
    } catch (err) {
        showNotification(td(err.message) || td('كلمة المرور الحالية غير صحيحة'), 'error');
    }
}

window.addEventListener('userDataLoaded', () => {
    populateProfileData();
});

document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editProfileForm');
    if (editForm) editForm.addEventListener('submit', handleUpdateProfile);

    const changePassForm = document.getElementById('changePasswordForm');
    if (changePassForm) changePassForm.addEventListener('submit', handleChangePassword);

    const editUsername = document.getElementById('editProfileUsername');
    if (editUsername) editUsername.addEventListener('input', handleEditUsernameInput);

    const avatarInput = document.getElementById('avatarFileInput');
    if (avatarInput) avatarInput.addEventListener('change', handleAvatarFileChange);

    populateProfileData();
});
