(function () {
    'use strict';

    // Global items Array
    let itemsData = [];

    // Configuration
    const ITEM_HEIGHT = 50; // Pixels per item (CSS එකෙහි height එකට සමාන විය යුතුය)
    const BUFFER_ITEMS = 5; // Viewport එකට ඉහළින් සහ පහළින් render කරන අමතර Items ගණන

    // DOM Elements
    const container = document.getElementById('virtual-scroll-container');
    const spacer = document.getElementById('virtual-spacer');
    const content = document.getElementById('virtual-content');
    const addBtn = document.getElementById('add-items-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusText = document.getElementById('status');

    let isTicking = false;

    // App Initialization
    document.addEventListener('DOMContentLoaded', () => {
        container.addEventListener('scroll', onScroll, { passive: true });
        addBtn.addEventListener('click', generateLargeData);
        clearBtn.addEventListener('click', clearData);
    });

    // 10,000 Items එකවර Generate කිරීම
    function generateLargeData() {
        const startId = itemsData.length + 1;
        const newItems = Array.from({ length: 10000 }, (_, i) => ({
            id: startId + i,
            title: `Item Record #${startId + i}`,
            tag: `ID: ${1000 + startId + i}`
        }));

        itemsData = itemsData.concat(newItems);
        updateVirtualList();
    }

    function clearData() {
        itemsData = [];
        updateVirtualList();
    }

    // Scroll performance optimize කිරීම සඳහා requestAnimationFrame භාවිතය
    function onScroll() {
        if (!isTicking) {
            requestAnimationFrame(() => {
                renderVisibleItems();
                isTicking = false;
            });
            isTicking = true;
        }
    }

    function updateVirtualList() {
        // Spacer එක මගින් මුළු ලැයිස්තුවේ සැබෑ උස (Total Height) සකසයි
        const totalHeight = itemsData.length * ITEM_HEIGHT;
        spacer.style.height = `${totalHeight}px`;

        statusText.innerText = `Items: ${itemsData.length.toLocaleString()}`;
        renderVisibleItems();
    }

    // Screen එකට පෙනෙන කොටස (Viewport) පමණක් DOM එකට Render කිරීම
    function renderVisibleItems() {
        const scrollTop = container.scrollTop;
        const viewportHeight = container.clientHeight;

        // Viewport එක තුළ ඇති ප්‍රථම සහ අවසාන Index ගණනය කිරීම
        let startIndex = Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS;
        let endIndex = Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_ITEMS;

        startIndex = Math.max(0, startIndex);
        endIndex = Math.min(itemsData.length, endIndex);

        // Position Transform එක මගින් content එක නිවැරදි ස්ථානයට ගෙන යාම
        content.style.transform = `translateY(${startIndex * ITEM_HEIGHT}px)`;

        // DOM Elements Re-render කිරීම
        const fragment = document.createDocumentFragment();

        for (let i = startIndex; i < endIndex; i++) {
            const item = itemsData[i];
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <span class="item-title">${item.title}</span>
                <span class="item-tag">${item.tag}</span>
            `;
            fragment.appendChild(div);
        }

        content.innerHTML = '';
        content.appendChild(fragment);
    }
})();
