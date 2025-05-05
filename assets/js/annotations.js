// Annotations management

class AnnotationsManager {
    constructor() {
        this.annotations = [];
        this.filteredAnnotations = [];
        this.tags = [];
        this.topics = [];
        this.currentFilters = {
            search: '',
            type: '',
            tag: '',
            topic: '',
            sort: 'date-desc'
        };
        
        this.init();
    }
    
    async init() {
        console.log('[Annotations] Initializing annotations system');
        await this.loadAnnotations();
        this.setupEventListeners();
        this.displayAnnotations();
    }
    
    async loadAnnotations() {
        try {
            const response = await fetch('/annotations/annotation-index.json');
            const data = await response.json();
            
            this.annotations = data.annotations;
            this.tags = data.tags;
            this.topics = data.topics;
            
            console.log(`[Annotations] Loaded ${this.annotations.length} annotations`);
            this.populateFilters();
        } catch (error) {
            console.error('[Annotations] Error loading annotations:', error);
        }
    }
    
    populateFilters() {
        const tagFilter = document.getElementById('tagFilter');
        const topicFilter = document.getElementById('topicFilter');
        
        // Populate tag filter
        this.tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });
        
        // Populate topic filter
        this.topics.forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            option.textContent = topic;
            topicFilter.appendChild(option);
        });
    }
    
    setupEventListeners() {
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentFilters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });
        
        document.getElementById('typeFilter').addEventListener('change', (e) => {
            this.currentFilters.type = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('tagFilter').addEventListener('change', (e) => {
            this.currentFilters.tag = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('topicFilter').addEventListener('change', (e) => {
            this.currentFilters.topic = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('sortOrder').addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.applyFilters();
        });
    }
    
    applyFilters() {
        let filtered = [...this.annotations];
        
        // Apply search filter
        if (this.currentFilters.search) {
            filtered = filtered.filter(annotation => 
                annotation.title.toLowerCase().includes(this.currentFilters.search) ||
                (annotation.preview && annotation.preview.toLowerCase().includes(this.currentFilters.search)) ||
                (annotation.authors && annotation.authors.some(author => 
                    author.toLowerCase().includes(this.currentFilters.search)
                ))
            );
        }
        
        // Apply type filter
        if (this.currentFilters.type) {
            filtered = filtered.filter(annotation => annotation.type === this.currentFilters.type);
        }
        
        // Apply tag filter
        if (this.currentFilters.tag) {
            filtered = filtered.filter(annotation => 
                annotation.tags && annotation.tags.includes(this.currentFilters.tag)
            );
        }
        
        // Apply topic filter
        if (this.currentFilters.topic) {
            filtered = filtered.filter(annotation => 
                annotation.topics && annotation.topics.includes(this.currentFilters.topic)
            );
        }
        
        // Apply sorting
        switch (this.currentFilters.sort) {
            case 'date-asc':
                filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'title':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'date-desc':
            default:
                filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
        }
        
        this.filteredAnnotations = filtered;
        this.displayAnnotations();
    }
    
    displayAnnotations() {
        const container = document.getElementById('annotationsList');
        
        // If there are no annotations in the index, keep the placeholder and exit
        if (this.annotations.length === 0) {
            return;
        }
        
        // Clear the container (removing the placeholder)
        container.innerHTML = '';
        
        // If there are no annotations matching the current filters
        if (this.filteredAnnotations.length === 0) {
            container.innerHTML = '<p>No annotations found matching your criteria.</p>';
            return;
        }
        
        this.filteredAnnotations.forEach(annotation => {
            const card = this.createAnnotationCard(annotation);
            container.appendChild(card);
        });
    }
    
    createAnnotationCard(annotation) {
        const card = document.createElement('article');
        card.className = 'annotation-card';
        
        const typeIcon = annotation.type === 'paper' ? '📄' : '📚';
        const date = new Date(annotation.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        let authorsText = '';
        if (annotation.authors && annotation.authors.length > 0) {
            authorsText = `${annotation.authors.slice(0, 2).join(', ')}${annotation.authors.length > 2 ? ', et al.' : ''}`;
        }
        
        card.innerHTML = `
            <h2><a href="${annotation.path}">${typeIcon} ${annotation.title}</a></h2>
            ${authorsText ? `<p class="authors">${authorsText}</p>` : ''}
            <p class="date">Annotated on ${date}</p>
            ${annotation.preview ? `<p class="preview">${annotation.preview}</p>` : ''}
            <div class="metadata-footer">
                ${annotation.tags ? annotation.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
                ${annotation.topics ? annotation.topics.map(topic => `<span class="topic-tag">${topic}</span>`).join('') : ''}
            </div>
        `;
        
        return card;
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AnnotationsManager());
} else {
    new AnnotationsManager();
}
