import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises'; // Removed unlink import
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        // Parse the incoming request
        const { url, title, content } = await req.json();
        const { searchParams } = new URL(url);
        const slug = searchParams.get('slug') || '';
        const date = new Date().toISOString().split('T')[0];

        // Construct the file path for the markdown file
        const filePath = path.join(process.cwd(), 'public', 'posts', `${date}_${slug}.md`);
        const dirPath = path.dirname(filePath);

        // Create the directory if it doesn't exist
        await mkdir(dirPath, { recursive: true });

        // Create the markdown content
        const markdown = `---
title: ${title}
date: ${date}
slug: ${slug}
---
${content}`;

        // Write the markdown file
        await writeFile(filePath, markdown);

        // Build and export the Next.js application
        const buildCommand = `next build && next export`;
        await execAsync(buildCommand);

        // Return success response
        return NextResponse.json({ message: 'Post created successfully' });

    } catch (error) {
        console.error('Error creating post:', error);
        return NextResponse.json(
            { error: 'Failed to create post' },
            { status: 500 }
        );
    }
}