import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set, onValue, push, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyAugtCukOXzXcAkRN64YMYTTceEcwQWzFI",
    authDomain: "survey-for-clinical-needs.firebaseapp.com",
    databaseURL: "https://survey-for-clinical-needs-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "survey-for-clinical-needs",
    storageBucket: "survey-for-clinical-needs.firebasestorage.app",
    messagingSenderId: "589958428208",
    appId: "1:589958428208:web:d1710da5dab033c5535ff5"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let phoneRules = [];
fetch('https://raw.githubusercontent.com/carlgeng/survey-clinicalneeds/refs/heads/main/phoneRules.json')
    .then(response => {
        if (!response.ok) throw new Error('无法加载 phoneRules.json: ' + response.status);
        return response.json();
    })
    .then(data => {
        phoneRules = data;
        populateCountryCodes();
    })
    .catch(error => {
        console.error('加载 phoneRules.json 失败:', error);
        document.getElementById('message').textContent = '电话规则加载失败，请稍后重试';
    });

let selectedCountryCode = null;
const dropdown = document.getElementById('countryCodeDropdown');
const selectedCountry = document.getElementById('selectedCountry');
const countryList = document.getElementById('countryList');

function populateCountryCodes() {
    countryList.innerHTML = '';
    phoneRules.forEach(rule => {
        const li = document.createElement('li');
        li.innerHTML = `<img src="${rule.flag}" class="flag">${rule.countryCode} (${rule.countryName})`;
        li.dataset.value = rule.countryCode;
        li.addEventListener('click', () => {
            selectedCountry.innerHTML = `<img src="${rule.flag}" class="flag">${rule.countryCode}`;
            selectedCountryCode = rule.countryCode;
            countryList.classList.remove('visible'); // 隐藏时移除 visible
            countryList.classList.add('hidden');    // 添加 hidden
        });
        countryList.appendChild(li);
    });

    selectedCountry.addEventListener('click', () => {
        if (countryList.classList.contains('visible')) {
            countryList.classList.remove('visible');
            setTimeout(() => countryList.classList.add('hidden'), 200); // 等待动画完成再隐藏
        } else {
            countryList.classList.remove('hidden');
            setTimeout(() => countryList.classList.add('visible'), 10); // 延迟添加 visible 以触发动画
        }
    });

    // 默认选择第一个国家
    if (phoneRules.length > 0) {
        selectedCountry.innerHTML = `<i class="fas fa-globe"></i> <img src="${phoneRules[0].flag}" class="flag">${phoneRules[0].countryCode}`;
        selectedCountryCode = phoneRules[0].countryCode;
    }
}

function loadCustomFields() {
    const customFieldsDiv = document.getElementById('customFields');
    customFieldsDiv.innerHTML = '';
    onValue(ref(database, 'fields'), (snapshot) => {
        const fields = snapshot.val() || {};
        for (let key in fields) {
            const fieldName = fields[key].name;
            const fieldId = fieldName.replace(/\s+/g, '_').toLowerCase();
            const div = document.createElement('div');
            div.className = 'field-container';
            div.innerHTML = `
                <label>${fieldName}: <input type="text" id="${fieldId}" required></label>
                <label><input type="checkbox" id="${fieldId}_onchain" checked> 上链</label>
            `;
            customFieldsDiv.appendChild(div);
        }
    });
}

document.getElementById('addFieldBtn').addEventListener('click', () => {
    const newFieldNameInput = document.getElementById('newFieldName');
    const fieldName = newFieldNameInput.value.trim();
    const fieldMessage = document.getElementById('fieldMessage');

    if (!fieldName) {
        fieldMessage.textContent = '字段名不能为空！';
        return;
    }

    get(ref(database, 'fields')).then((snapshot) => {
        const fields = snapshot.val() || {};
        const fieldCount = Object.keys(fields).length;

        if (fieldCount >= 5) {
            fieldMessage.textContent = '最多只能添加5个字段！';
        } else {
            push(ref(database, 'fields'), { name: fieldName })
                .then(() => {
                    fieldMessage.textContent = '字段添加成功！';
                    newFieldNameInput.value = '';
                    loadCustomFields();
                })
                .catch((error) => {
                    fieldMessage.textContent = '添加失败：' + error.message;
                });
        }
    });
});

const phoneInput = document.getElementById('phone');
const emailInput = document.getElementById('email');
const phoneError = document.getElementById('phone_error');
const emailError = document.getElementById('email_error');

phoneInput.addEventListener('input', () => {
    const rule = phoneRules.find(r => r.countryCode === selectedCountryCode);
    const phone = phoneInput.value;
    let isValid = false;

    if (!rule) return;
    if (Array.isArray(rule.phoneLength)) {
        isValid = rule.phoneLength.some(len => phone.length === len) && new RegExp(rule.pattern).test(phone);
    } else {
        isValid = phone.length === rule.phoneLength && new RegExp(rule.pattern).test(phone);
    }

    if (!isValid) {
        phoneError.textContent = `请输入${Array.isArray(rule.phoneLength) ? rule.phoneLength.join('-') : rule.phoneLength}位有效号码（${rule.cityCode ? '含城市码 ' + rule.cityCode : '无城市码'}）`;
    } else {
        phoneError.textContent = '';
    }
});

emailInput.addEventListener('input', () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailInput.value)) {
        emailError.textContent = '请输入有效的邮箱地址';
    } else {
        emailError.textContent = '';
    }
});

document.getElementById('userForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const countryCode = selectedCountryCode;
    const phone = phoneInput.value;
    const email = emailInput.value;
    const fullPhone = countryCode + phone;
    const rule = phoneRules.find(r => r.countryCode === countryCode);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let isPhoneValid = false;

    if (!rule) {
        document.getElementById('message').textContent = '电话规则未加载';
        return;
    }
    if (Array.isArray(rule.phoneLength)) {
        isPhoneValid = rule.phoneLength.some(len => phone.length === len) && new RegExp(rule.pattern).test(phone);
    } else {
        isPhoneValid = phone.length === rule.phoneLength && new RegExp(rule.pattern).test(phone);
    }

    if (!isPhoneValid) {
        document.getElementById('message').textContent = '电话号码格式错误';
        return;
    }
    if (!emailPattern.test(email)) {
        document.getElementById('message').textContent = '邮件地址格式错误';
        return;
    }

    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    const users = snapshot.val() || {};
    let phoneExists = false;
    let emailExists = false;

    for (let key in users) {
        const user = users[key];
        if (user.phone && user.phone.value === fullPhone) phoneExists = true;
        if (user.email && user.email.value === email) emailExists = true;
    }

    if (phoneExists) {
        document.getElementById('message').textContent = '电话号码已存在';
        return;
    }
    if (emailExists) {
        document.getElementById('message').textContent = '邮件地址已存在';
        return;
    }

    const data = {};
    const defaultFields = ['name', 'phone', 'email', 'job'];
    defaultFields.forEach(field => {
        if (field === 'phone') {
            data[field] = {
                value: fullPhone,
                onChain: document.getElementById(`${field}_onchain`).checked
            };
        } else {
            data[field] = {
                value: document.getElementById(field).value,
                onChain: document.getElementById(`${field}_onchain`).checked
            };
        }
    });

    const customFieldsDiv = document.getElementById('customFields');
    customFieldsDiv.querySelectorAll('input[type="text"]').forEach(input => {
        const fieldId = input.id;
        data[fieldId] = {
            value: input.value,
            onChain: document.getElementById(`${fieldId}_onchain`).checked
        };
    });

    set(ref(database, 'users/' + Date.now()), data)
        .then(() => {
            document.getElementById('message').textContent = '信息已成功保存！';
            document.getElementById('userForm').reset();
            loadCustomFields();
        })
        .catch((error) => {
            document.getElementById('message').textContent = '保存失败：' + error.message;
        });
});

loadCustomFields();
