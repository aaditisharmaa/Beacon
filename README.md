# BEACON

BEACON is a behavior-aware desktop companion for academic task management and opportunity discovery.

## Features

- JWT user accounts and onboarding profiles
- AI task extraction from pasted text, voice, clipboard, and screenshots
- Deadline, complexity, and snooze-aware priority scoring
- Full and survival roadmaps with resource searches
- Adaptive friendly/nudging/strict avatar
- Desktop inactivity and Focus Mode app monitoring
- Google Calendar review-before-import
- Skill extraction and matching opportunities
- Weekly analytics and meeting action-item extraction

## Local development

### Backend

```powers
cd backend
python -m pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver 127.0.0.1:8001
```

Optional opportunity sync:

```powers
$env:OPPORTUNITY_FEEDS="https://example.com/events.xml"
python manage.py sync_opportunities
python manage.py seed_opportunities
```

### Desktop

```powers
cd desktop
npm install
npm run electron:dev
```

Set `VITE_API_URL` to a hosted backend URL when building a distributed desktop application.

## Tests

```powers
cd backend
python manage.py test

cd ../desktop
npm run build
npm run lint
```

## Windows installer

```powers
cd desktop
npm install
npm run electron:build
```

The NSIS installer is written to `desktop/release/`.
