// Generate annotation index from individual annotation files

const fs = require('fs').promises;
const path = require('path');

async function extractAnnotationMetadata(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        
        // Extract metadata from HTML comments
        const metaMatch = content.match(/ANNOTATION_META\s*([\s\S]*?)\s*END_ANNOTATION_META/);
        if (!metaMatch) {
            console.warn(`No metadata found in ${filePath}`);
            return null;
        }
        
        const metadata = JSON.parse(metaMatch[1]);
        
        // Extract the first paragraph for preview/description
        const contentMatch = content.match(/<section class="key-insights">([\s\S]*?)<\/section>/);
        if (contentMatch) {
            // Get the first paragraph
            const paragraphMatch = contentMatch[1].match(/<p>([\s\S]*?)<\/p>/);
            if (paragraphMatch) {
                metadata.preview = paragraphMatch[1]
                    .replace(/<[^>]*>/g, '')  // Remove HTML tags
                    .trim()
                    .slice(0, 150);  // Limit to 150 characters
                
                // Add ellipsis if truncated
                if (paragraphMatch[1].length > 150) {
                    metadata.preview += '...';
                }
            }
        }
        
        // Get filename for URL reference
        metadata.filename = path.basename(filePath);
        metadata.path = `/annotations/entries/${metadata.filename}`;
        
        return metadata;
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
        return null;
    }
}

async function generateAnnotationIndex() {
    try {
        const annotationsDir = path.join(__dirname, '../annotations/entries');
        const files = await fs.readdir(annotationsDir);
        
        const annotations = [];
        const tags = new Set();
        const topics = new Set();
        
        for (const file of files) {
            if (file.endsWith('.html')) {
                const metadata = await extractAnnotationMetadata(path.join(annotationsDir, file));
                if (metadata) {
                    annotations.push(metadata);
                    
                    // Collect tags and topics
                    if (metadata.tags) {
                        metadata.tags.forEach(tag => tags.add(tag));
                    }
                    if (metadata.topics) {
                        metadata.topics.forEach(topic => topics.add(topic));
                    }
                }
            }
        }
        
        // Sort annotations by date, newest first
        annotations.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const index = {
            annotations,
            tags: Array.from(tags).sort(),
            topics: Array.from(topics).sort(),
            lastUpdated: new Date().toISOString()
        };
        
        // Write the index file
        await fs.writeFile(
            path.join(__dirname, '../annotations/annotation-index.json'),
            JSON.stringify(index, null, 2)
        );
        
        console.log(`Generated annotation index with ${annotations.length} entries`);
        console.log(`Tags: ${tags.size}, Topics: ${topics.size}`);
        
    } catch (error) {
        console.error('Error generating annotation index:', error);
    }
}

generateAnnotationIndex();
