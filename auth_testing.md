## TEST AGENT PROMPT - AUTH TESTING RULES ##

Auth-Gated App Testing Playbook

Step 1: Create Test User & Session
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test Farmer',
  picture: '',
  farm_info: { farm_name: 'Test Farm', farm_size: '5 acres', crops: ['Rice', 'Wheat'] },
  location: { lat: 13.0, lon: 80.0, name: 'Chennai' },
  soil_profile: { soil_type: 'Red Laterite', ph: 6.2, source: 'regional_estimate' },
  language: 'en',
  onboarding_complete: true,
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

Step 2: Browser Testing - Set cookie for auth
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "harvest-advisor-pro.preview.emergentagent.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
```

Checklist:
- User document has user_id field
- Session user_id matches user's user_id
- All queries use {"_id": 0} projection
- API returns user data (not 401)
- Dashboard loads without redirect
