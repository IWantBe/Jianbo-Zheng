document.addEventListener('DOMContentLoaded', function() {
    watchGitHubStars();
    loadGitHubStars(document);
    initVisitCounter();

    // Load all sections
    const sections = [
        { id: 'selectedPublications', url: 'sections/publications_selected.html' },
        { id: 'fullPublications', url: 'sections/publications_full.html' },
        { id: 'recruitment-section', url: 'sections/recruitment.html' },
        { id: 'services-section', url: 'sections/services.html' },
        { id: 'projects-section', url: 'sections/projects.html' },
        { id: 'awards-section', url: 'sections/awards.html' },
        { id: 'contact-section', url: 'sections/contact.html' }
    ];

    sections.forEach(section => loadSection(section.id, section.url));
});

// Function to load external HTML content
function loadSection(elementId, url) {
    const element = document.getElementById(elementId);
    if (!element) return;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            element.innerHTML = data;
            loadGitHubStars(element);
        })
        .catch(error => {
            console.error(`Error loading section ${elementId}:`, error);
            element.innerHTML = '<p>Error loading content.</p>';
        });
}

// Load live GitHub star counts for badges
function loadGitHubStars(scope = document) {
    const starBadges = scope.querySelectorAll('[data-github-repo]');

    starBadges.forEach(badge => {
        const repo = badge.dataset.githubRepo;
        const countElement = badge.querySelector('.github-star-count');

        if (!repo || !countElement) return;
        if (badge.dataset.githubStarsLoaded === 'true' || badge.dataset.githubStarsLoading === 'true') return;

        badge.dataset.githubStarsLoading = 'true';

        fetchGitHubStarCount(repo)
            .then(count => setGitHubStarCount(badge, countElement, count))
            .catch(error => {
                console.error(`Error loading GitHub stars for ${repo}:`, error);
                countElement.textContent = 'Stars';
                badge.classList.add('github-stars-unavailable');
            })
            .finally(() => {
                delete badge.dataset.githubStarsLoading;
                badge.dataset.githubStarsLoaded = 'true';
            });
    });
}

function watchGitHubStars() {
    const observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => mutation.addedNodes.length > 0)) {
            loadGitHubStars(document);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function fetchGitHubStarCount(repo) {
    return fetch(`https://api.github.com/repos/${repo}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (typeof data.stargazers_count !== 'number') {
                throw new Error('GitHub API response missing stargazers_count');
            }
            return data.stargazers_count;
        })
        .catch(apiError => fetchShieldsStarCount(repo).catch(() => {
            throw apiError;
        }));
}

function fetchShieldsStarCount(repo) {
    return fetch(`https://img.shields.io/github/stars/${repo}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Shields API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => parseStarCount(data.message));
}

function setGitHubStarCount(badge, countElement, count) {
    countElement.textContent = formatStarCount(count);
    badge.setAttribute('aria-label', `${count} GitHub stars`);
    badge.classList.remove('github-stars-unavailable');
}

function formatStarCount(count) {
    if (typeof count !== 'number') return 'Stars';
    if (count < 1000) return count.toString();

    const formatted = (count / 1000).toFixed(count < 10000 ? 1 : 0);
    return `${formatted.replace(/\.0$/, '')}k`;
}

function parseStarCount(value) {
    if (typeof value !== 'string') {
        throw new Error('Invalid star count');
    }

    const normalized = value.trim().toLowerCase().replace(/,/g, '');
    const match = normalized.match(/^([\d.]+)\s*([km]?)$/);
    if (!match) {
        throw new Error(`Invalid star count: ${value}`);
    }

    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) {
        throw new Error(`Invalid star count: ${value}`);
    }

    const multiplier = match[2] === 'm' ? 1000000 : match[2] === 'k' ? 1000 : 1;
    return Math.round(amount * multiplier);
}

// Publications toggle function
function showFullList() {
    document.getElementById('selectedPublications').style.display = 'none';
    document.getElementById('fullPublications').style.display = 'block';
    document.getElementById('showFullListBtn').style.display = 'none';
    document.getElementById('showSelectedListBtn').style.display = 'inline';

    updatePubHeader('以下为全部论文。');
}

function showSelectedList() {
    document.getElementById('selectedPublications').style.display = 'block';
    document.getElementById('fullPublications').style.display = 'none';
    document.getElementById('showFullListBtn').style.display = 'inline';
    document.getElementById('showSelectedListBtn').style.display = 'none';

    updatePubHeader('以下为近五年代表性论文。');
}

function updatePubHeader(desc) {
    const pubDesc = document.getElementById('publication-desc');
    if (pubDesc) pubDesc.textContent = desc;
}

// ---- Visit counter ----
// 1) 立即显示本地计数（保证离线/校内网络下也能正常显示，从 0 开始累计）
// 2) 异步请求全局计数 API；成功则替换为全局数字，失败则保留本地计数
function initVisitCounter() {
    const el = document.getElementById('visit-count');
    if (!el) return;

    let localCount = parseInt(localStorage.getItem('zjb_visit_count') || '0', 10);
    if (isNaN(localCount) || localCount < 0) localCount = 0;
    localCount += 1;
    localStorage.setItem('zjb_visit_count', String(localCount));
    el.textContent = localCount;

    // 4 秒内拿不到全局计数就沿用本地数字
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    fetch('https://api.counterapi.dev/v1/zhengjianbo-hunnu/homepage/up', { signal: controller.signal })
        .then(res => {
            if (!res.ok) throw new Error('counter api error');
            return res.json();
        })
        .then(data => {
            clearTimeout(timer);
            if (typeof data.count === 'number') {
                el.textContent = data.count;
            }
        })
        .catch(() => {
            clearTimeout(timer);
            // 静默失败，继续使用本地计数
        });
}
