-- Create events table in Supabase
-- Run this SQL in your Supabase SQL editor if the events table doesn't exist

CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    photo VARCHAR(500),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    community_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create communities table for storing community information
CREATE TABLE IF NOT EXISTS communities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT 'Welcome to our vibrant community! We host various events and activities for all members.',
    logo VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create an index for faster queries by community_id
CREATE INDEX IF NOT EXISTS idx_events_community_id ON events(community_id);

-- Create an index for faster queries by start_time
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);

-- Enable RLS (Row Level Security)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- Events table policies
-- Create policy to allow users to see all events (public read)
CREATE POLICY "Allow public read access" ON events
    FOR SELECT USING (true);

-- Create policy to allow community users to insert their own events
CREATE POLICY "Allow community users to insert events" ON events
    FOR INSERT WITH CHECK (true);

-- Create policy to allow community users to update their own events
CREATE POLICY "Allow community users to update their own events" ON events
    FOR UPDATE USING (true);

-- Create policy to allow community users to delete their own events
CREATE POLICY "Allow community users to delete their own events" ON events
    FOR DELETE USING (true);

-- Communities table policies
-- Create policy to allow users to see all communities (public read)
CREATE POLICY "Allow public read access" ON communities
    FOR SELECT USING (true);

-- Create policy to allow community users to insert their own community info
CREATE POLICY "Allow community users to insert communities" ON communities
    FOR INSERT WITH CHECK (true);

-- Create policy to allow community users to update their own community info
CREATE POLICY "Allow community users to update their own communities" ON communities
    FOR UPDATE USING (true);
