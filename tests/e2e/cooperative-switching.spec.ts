/**
 * End-to-End Tests for Cooperative Switching
 * 
 * Tests the full user experience of switching between Swedish BRF cooperatives,
 * including authentication, data isolation, and UI state management.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

interface TestCooperative {
  id: string;
  name: string;
  subdomain: string;
  testUser: {
    email: string;
    password: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

const TEST_COOPERATIVES: TestCooperative[] = [
  {
    id: 'coop_1',
    name: 'BRF Östermalm Park',
    subdomain: 'ostermalm-park',
    testUser: {
      email: 'anna.andersson@ostermalm-park.brf.se',
      password: 'TestPass123!',
      role: 'chairman',
      firstName: 'Anna',
      lastName: 'Andersson'
    }
  },
  {
    id: 'coop_2',
    name: 'BRF Södermalm Terrassen',
    subdomain: 'sodermalm-terrassen',
    testUser: {
      email: 'erik.johansson@sodermalm-terrassen.brf.se',
      password: 'TestPass123!',
      role: 'treasurer',
      firstName: 'Erik',
      lastName: 'Johansson'
    }
  },
  {
    id: 'coop_3',
    name: 'BRF Vasastan Garden',
    subdomain: 'vasastan-garden',
    testUser: {
      email: 'maria.karlsson@vasastan-garden.brf.se',
      password: 'TestPass123!',
      role: 'member',
      firstName: 'Maria',
      lastName: 'Karlsson'
    }
  }
];

test.describe('🏢 Cooperative Switching E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/');
    
    // Wait for application to load
    await expect(page).toHaveTitle(/BRF Portal/);
  });

  test.describe('Authentication & Initial Login', () => {
    test('should successfully log into first cooperative', async ({ page }) => {
      const coop = TEST_COOPERATIVES[0];
      
      await test.step('Navigate to login page', async () => {
        await page.goto('/auth/login');
        await expect(page.locator('h1')).toContainText('Logga in');
      });
      
      await test.step('Enter credentials and login', async () => {
        await page.fill('[data-testid=email-input]', coop.testUser.email);
        await page.fill('[data-testid=password-input]', coop.testUser.password);
        await page.click('[data-testid=login-button]');
      });
      
      await test.step('Verify successful login and cooperative context', async () => {
        await expect(page).toHaveURL('/dashboard');
        
        // Check cooperative name is displayed
        await expect(page.locator('[data-testid=cooperative-name]')).toContainText(coop.name);
        
        // Check user info is displayed
        await expect(page.locator('[data-testid=user-name]')).toContainText(coop.testUser.firstName);
        
        // Check role is displayed correctly
        await expect(page.locator('[data-testid=user-role]')).toContainText(coop.testUser.role);
      });
      
      await test.step('Verify dashboard shows cooperative-specific data', async () => {
        // Wait for dashboard to load data
        await page.waitForLoadState('networkidle');
        
        // Check that only this cooperative's data is shown
        const cooperativeSelector = '[data-cooperative-id]';
        const cooperativeElements = await page.locator(cooperativeSelector).all();
        
        for (const element of cooperativeElements) {
          const cooperativeId = await element.getAttribute('data-cooperative-id');
          expect(cooperativeId).toBe(coop.id);
        }
      });
    });
  });

  test.describe('Cooperative Switching', () => {
    test('should switch between cooperatives maintaining data isolation', async ({ page }) => {
      const coop1 = TEST_COOPERATIVES[0];
      const coop2 = TEST_COOPERATIVES[1];
      
      await test.step('Login to first cooperative', async () => {
        await page.goto('/auth/login');
        await page.fill('[data-testid=email-input]', coop1.testUser.email);
        await page.fill('[data-testid=password-input]', coop1.testUser.password);
        await page.click('[data-testid=login-button]');
        await expect(page).toHaveURL('/dashboard');
      });
      
      await test.step('Record initial cooperative state', async () => {
        await page.waitForLoadState('networkidle');
        
        // Navigate to members page to see data
        await page.click('[data-testid=nav-members]');
        await expect(page).toHaveURL('/members');
        
        // Count members in first cooperative
        const coop1Members = await page.locator('[data-testid=member-card]').count();
        expect(coop1Members).toBeGreaterThan(0);
        
        // Store member data for comparison
        const coop1MemberNames = await page.locator('[data-testid=member-name]').allTextContents();
        
        // Navigate to apartments
        await page.click('[data-testid=nav-apartments]');
        await expect(page).toHaveURL('/apartments');
        const coop1Apartments = await page.locator('[data-testid=apartment-card]').count();
        
        // Store data for later comparison
        page.evaluate((data) => {
          window.sessionStorage.setItem('coop1TestData', JSON.stringify(data));
        }, {
          memberCount: coop1Members,
          memberNames: coop1MemberNames,
          apartmentCount: coop1Apartments,
          cooperativeId: coop1.id
        });
      });
      
      await test.step('Switch to second cooperative', async () => {
        // Open cooperative switcher
        await page.click('[data-testid=cooperative-switcher]');
        await expect(page.locator('[data-testid=cooperative-switcher-menu]')).toBeVisible();
        
        // Select second cooperative
        await page.click(`[data-testid=switch-to-${coop2.subdomain}]`);
        
        // Should be redirected to login for second cooperative
        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.locator('[data-testid=cooperative-context]')).toContainText(coop2.name);
      });
      
      await test.step('Login to second cooperative', async () => {
        await page.fill('[data-testid=email-input]', coop2.testUser.email);
        await page.fill('[data-testid=password-input]', coop2.testUser.password);
        await page.click('[data-testid=login-button]');
        await expect(page).toHaveURL('/dashboard');
      });
      
      await test.step('Verify complete data isolation in second cooperative', async () => {
        await page.waitForLoadState('networkidle');
        
        // Check cooperative context switched
        await expect(page.locator('[data-testid=cooperative-name]')).toContainText(coop2.name);
        await expect(page.locator('[data-testid=user-name]')).toContainText(coop2.testUser.firstName);
        
        // Navigate to members page
        await page.click('[data-testid=nav-members]');
        await expect(page).toHaveURL('/members');
        
        const coop2Members = await page.locator('[data-testid=member-card]').count();
        const coop2MemberNames = await page.locator('[data-testid=member-name]').allTextContents();
        
        // Navigate to apartments
        await page.click('[data-testid=nav-apartments]');
        const coop2Apartments = await page.locator('[data-testid=apartment-card]').count();
        
        // Retrieve stored data from first cooperative
        const coop1Data = await page.evaluate(() => {
          return JSON.parse(window.sessionStorage.getItem('coop1TestData') || '{}');
        });
        
        // Verify no data overlap
        expect(coop2Members).toBeGreaterThan(0);
        expect(coop2Apartments).toBeGreaterThan(0);
        
        // Verify different data sets (no member names should overlap)
        const memberNameOverlap = coop1Data.memberNames?.filter((name: string) => 
          coop2MemberNames.includes(name)
        );
        expect(memberNameOverlap?.length || 0).toBe(0);
        
        // Verify cooperative context is consistent
        const allCooperativeIds = await page.locator('[data-cooperative-id]').all();
        for (const element of allCooperativeIds) {
          const cooperativeId = await element.getAttribute('data-cooperative-id');
          expect(cooperativeId).toBe(coop2.id);
        }
      });
      
      await test.step('Switch back to first cooperative and verify data consistency', async () => {
        // Switch back to first cooperative
        await page.click('[data-testid=cooperative-switcher]');
        await page.click(`[data-testid=switch-to-${coop1.subdomain}]`);
        
        // Login again
        await page.fill('[data-testid=email-input]', coop1.testUser.email);
        await page.fill('[data-testid=password-input]', coop1.testUser.password);
        await page.click('[data-testid=login-button]');
        await expect(page).toHaveURL('/dashboard');
        
        // Verify we're back to the original cooperative context
        await expect(page.locator('[data-testid=cooperative-name]')).toContainText(coop1.name);
        
        // Check that data is consistent with initial state
        await page.click('[data-testid=nav-members]');
        const returnedCoop1Members = await page.locator('[data-testid=member-card]').count();
        const returnedCoop1MemberNames = await page.locator('[data-testid=member-name]').allTextContents();
        
        const coop1Data = await page.evaluate(() => {
          return JSON.parse(window.sessionStorage.getItem('coop1TestData') || '{}');
        });
        
        // Data should be exactly the same as before switching
        expect(returnedCoop1Members).toBe(coop1Data.memberCount);
        expect(returnedCoop1MemberNames.sort()).toEqual(coop1Data.memberNames.sort());
      });
    });

    test('should handle role-based permissions during cooperative switching', async ({ page }) => {
      const chairmanCoop = TEST_COOPERATIVES[0]; // Chairman role
      const memberCoop = TEST_COOPERATIVES[2]; // Regular member role
      
      await test.step('Login as chairman and verify administrative access', async () => {
        await page.goto('/auth/login');
        await page.fill('[data-testid=email-input]', chairmanCoop.testUser.email);
        await page.fill('[data-testid=password-input]', chairmanCoop.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Navigate to admin-level features
        await page.click('[data-testid=nav-admin]');
        await expect(page).toHaveURL('/admin');
        
        // Verify chairman can see admin functions
        await expect(page.locator('[data-testid=admin-board-meetings]')).toBeVisible();
        await expect(page.locator('[data-testid=admin-user-management]')).toBeVisible();
        await expect(page.locator('[data-testid=admin-financial-reports]')).toBeVisible();
      });
      
      await test.step('Switch to regular member cooperative', async () => {
        await page.click('[data-testid=cooperative-switcher]');
        await page.click(`[data-testid=switch-to-${memberCoop.subdomain}]`);
        
        await page.fill('[data-testid=email-input]', memberCoop.testUser.email);
        await page.fill('[data-testid=password-input]', memberCoop.testUser.password);
        await page.click('[data-testid=login-button]');
      });
      
      await test.step('Verify limited access as regular member', async () => {
        // Admin menu should not be visible
        await expect(page.locator('[data-testid=nav-admin]')).not.toBeVisible();
        
        // Try to navigate to admin directly (should be blocked)
        await page.goto('/admin');
        await expect(page).toHaveURL('/unauthorized');
        await expect(page.locator('[data-testid=error-message]')).toContainText('insufficient permissions');
        
        // Navigate back to dashboard
        await page.click('[data-testid=nav-dashboard]');
        
        // Verify member can see basic functions
        await expect(page.locator('[data-testid=nav-cases]')).toBeVisible();
        await expect(page.locator('[data-testid=nav-documents]')).toBeVisible();
        await expect(page.locator('[data-testid=nav-bookings]')).toBeVisible();
      });
    });
  });

  test.describe('Data Isolation Verification', () => {
    test('should prevent cross-cooperative data leakage in UI', async ({ page }) => {
      const coop1 = TEST_COOPERATIVES[0];
      const coop2 = TEST_COOPERATIVES[1];
      
      await test.step('Create unique data in first cooperative', async () => {
        await page.goto('/auth/login');
        await page.fill('[data-testid=email-input]', coop1.testUser.email);
        await page.fill('[data-testid=password-input]', coop1.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Create a unique case
        await page.click('[data-testid=nav-cases]');
        await page.click('[data-testid=create-case-button]');
        
        const uniqueCaseTitle = `E2E Test Case ${Date.now()}`;
        await page.fill('[data-testid=case-title-input]', uniqueCaseTitle);
        await page.fill('[data-testid=case-description-input]', 'This case should not be visible in other cooperatives');
        await page.selectOption('[data-testid=case-category-select]', 'maintenance');
        await page.selectOption('[data-testid=case-priority-select]', 'normal');
        
        await page.click('[data-testid=save-case-button]');
        
        // Verify case was created
        await expect(page.locator(`[data-testid=case-title]:has-text("${uniqueCaseTitle}")`)).toBeVisible();
        
        // Store case title for later verification
        await page.evaluate((title) => {
          window.sessionStorage.setItem('uniqueCaseTitle', title);
        }, uniqueCaseTitle);
      });
      
      await test.step('Switch to second cooperative and verify data isolation', async () => {
        await page.click('[data-testid=cooperative-switcher]');
        await page.click(`[data-testid=switch-to-${coop2.subdomain}]`);
        
        await page.fill('[data-testid=email-input]', coop2.testUser.email);
        await page.fill('[data-testid=password-input]', coop2.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Navigate to cases in second cooperative
        await page.click('[data-testid=nav-cases]');
        await page.waitForLoadState('networkidle');
        
        // Retrieve unique case title from first cooperative
        const uniqueCaseTitle = await page.evaluate(() => {
          return window.sessionStorage.getItem('uniqueCaseTitle');
        });
        
        // Verify the unique case from first cooperative is NOT visible
        await expect(page.locator(`[data-testid=case-title]:has-text("${uniqueCaseTitle}")`)).not.toBeVisible();
        
        // Verify we can see cases, but they belong to second cooperative
        const caseCards = await page.locator('[data-testid=case-card]').all();
        
        for (const caseCard of caseCards) {
          const cooperativeId = await caseCard.getAttribute('data-cooperative-id');
          expect(cooperativeId).toBe(coop2.id);
        }
      });
    });

    test('should isolate financial data between cooperatives', async ({ page }) => {
      const coop1 = TEST_COOPERATIVES[0];
      const coop2 = TEST_COOPERATIVES[1];
      
      await test.step('View financial data in first cooperative', async () => {
        await page.goto('/auth/login');
        await page.fill('[data-testid=email-input]', coop1.testUser.email);
        await page.fill('[data-testid=password-input]', coop1.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Navigate to financial section
        await page.click('[data-testid=nav-finances]');
        await expect(page).toHaveURL('/finances');
        
        // Get invoice count and total amounts
        await page.click('[data-testid=invoices-tab]');
        const coop1Invoices = await page.locator('[data-testid=invoice-row]').count();
        const coop1TotalAmount = await page.locator('[data-testid=total-amount]').textContent();
        
        // Store financial data
        await page.evaluate((data) => {
          window.sessionStorage.setItem('coop1FinancialData', JSON.stringify(data));
        }, {
          invoiceCount: coop1Invoices,
          totalAmount: coop1TotalAmount
        });
      });
      
      await test.step('Verify different financial data in second cooperative', async () => {
        await page.click('[data-testid=cooperative-switcher]');
        await page.click(`[data-testid=switch-to-${coop2.subdomain}]`);
        
        await page.fill('[data-testid=email-input]', coop2.testUser.email);
        await page.fill('[data-testid=password-input]', coop2.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Navigate to financial section
        await page.click('[data-testid=nav-finances]');
        await page.click('[data-testid=invoices-tab]');
        
        const coop2Invoices = await page.locator('[data-testid=invoice-row]').count();
        const coop2TotalAmount = await page.locator('[data-testid=total-amount]').textContent();
        
        // Retrieve stored data
        const coop1Data = await page.evaluate(() => {
          return JSON.parse(window.sessionStorage.getItem('coop1FinancialData') || '{}');
        });
        
        // Financial data should be completely different
        expect(coop2Invoices).not.toBe(coop1Data.invoiceCount);
        expect(coop2TotalAmount).not.toBe(coop1Data.totalAmount);
        
        // Verify all financial records belong to correct cooperative
        const invoiceRows = await page.locator('[data-testid=invoice-row]').all();
        for (const row of invoiceRows) {
          const cooperativeId = await row.getAttribute('data-cooperative-id');
          expect(cooperativeId).toBe(coop2.id);
        }
      });
    });
  });

  test.describe('Session Management', () => {
    test('should handle session timeout during cooperative switching', async ({ page }) => {
      const coop = TEST_COOPERATIVES[0];
      
      await test.step('Login and setup short session timeout', async () => {
        await page.goto('/auth/login');
        await page.fill('[data-testid=email-input]', coop.testUser.email);
        await page.fill('[data-testid=password-input]', coop.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Simulate short session timeout for testing
        await page.evaluate(() => {
          // Override session timeout to 5 seconds for testing
          if (window.sessionManager) {
            window.sessionManager.setTimeoutForTesting(5000);
          }
        });
      });
      
      await test.step('Wait for session timeout', async () => {
        // Wait for session to expire
        await page.waitForTimeout(6000);
        
        // Try to navigate (should trigger session check)
        await page.click('[data-testid=nav-members]');
        
        // Should be redirected to login due to expired session
        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.locator('[data-testid=session-expired-message]')).toBeVisible();
      });
      
      await test.step('Re-login and verify session restoration', async () => {
        await page.fill('[data-testid=email-input]', coop.testUser.email);
        await page.fill('[data-testid=password-input]', coop.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Should be back in the correct cooperative context
        await expect(page.locator('[data-testid=cooperative-name]')).toContainText(coop.name);
        await expect(page).toHaveURL('/dashboard');
      });
    });

    test('should prevent concurrent sessions in different cooperatives', async ({ browser }) => {
      const coop1 = TEST_COOPERATIVES[0];
      const coop2 = TEST_COOPERATIVES[1];
      
      // Create two different browser contexts (simulate different browser windows)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      await test.step('Login to first cooperative in first context', async () => {
        await page1.goto('/auth/login');
        await page1.fill('[data-testid=email-input]', coop1.testUser.email);
        await page1.fill('[data-testid=password-input]', coop1.testUser.password);
        await page1.click('[data-testid=login-button]');
        
        await expect(page1.locator('[data-testid=cooperative-name]')).toContainText(coop1.name);
      });
      
      await test.step('Attempt login to second cooperative in second context', async () => {
        await page2.goto('/auth/login');
        await page2.fill('[data-testid=email-input]', coop2.testUser.email);
        await page2.fill('[data-testid=password-input]', coop2.testUser.password);
        await page2.click('[data-testid=login-button]');
        
        await expect(page2.locator('[data-testid=cooperative-name]')).toContainText(coop2.name);
      });
      
      await test.step('Verify sessions remain isolated', async () => {
        // Both sessions should work independently without interference
        await page1.click('[data-testid=nav-members]');
        await page2.click('[data-testid=nav-members]');
        
        await page1.waitForLoadState('networkidle');
        await page2.waitForLoadState('networkidle');
        
        // Verify different member lists
        const page1Members = await page1.locator('[data-testid=member-card]').count();
        const page2Members = await page2.locator('[data-testid=member-card]').count();
        
        expect(page1Members).toBeGreaterThan(0);
        expect(page2Members).toBeGreaterThan(0);
        
        // Verify cooperative context is maintained
        await expect(page1.locator('[data-testid=cooperative-name]')).toContainText(coop1.name);
        await expect(page2.locator('[data-testid=cooperative-name]')).toContainText(coop2.name);
      });
      
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Error Handling & Recovery', () => {
    test('should handle network errors during cooperative switching gracefully', async ({ page }) => {
      const coop1 = TEST_COOPERATIVES[0];
      const coop2 = TEST_COOPERATIVES[1];
      
      await test.step('Login to first cooperative', async () => {
        await page.goto('/auth/login');
        await page.fill('[data-testid=email-input]', coop1.testUser.email);
        await page.fill('[data-testid=password-input]', coop1.testUser.password);
        await page.click('[data-testid=login-button]');
        
        await expect(page.locator('[data-testid=cooperative-name]')).toContainText(coop1.name);
      });
      
      await test.step('Simulate network error during switching', async () => {
        // Intercept and fail the cooperative switch request
        await page.route('**/api/auth/switch-cooperative', route => {
          route.abort('failed');
        });
        
        await page.click('[data-testid=cooperative-switcher]');
        await page.click(`[data-testid=switch-to-${coop2.subdomain}]`);
        
        // Should show error message
        await expect(page.locator('[data-testid=error-message]')).toBeVisible();
        await expect(page.locator('[data-testid=error-message]')).toContainText('Network error');
        
        // Should remain in original cooperative
        await expect(page.locator('[data-testid=cooperative-name]')).toContainText(coop1.name);
      });
      
      await test.step('Verify recovery after network restoration', async () => {
        // Remove network interception
        await page.unroute('**/api/auth/switch-cooperative');
        
        // Retry cooperative switch
        await page.click('[data-testid=retry-switch-button]');
        
        // Should successfully redirect to login
        await expect(page).toHaveURL(/\/auth\/login/);
        
        // Complete switch
        await page.fill('[data-testid=email-input]', coop2.testUser.email);
        await page.fill('[data-testid=password-input]', coop2.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Should be in second cooperative
        await expect(page.locator('[data-testid=cooperative-name]')).toContainText(coop2.name);
      });
    });
  });
});

test.describe('🔒 Security & Performance Tests', () => {
  test('should maintain security during rapid cooperative switching', async ({ page }) => {
    const cooperatives = TEST_COOPERATIVES;
    
    await test.step('Perform rapid switching between all cooperatives', async () => {
      for (let i = 0; i < cooperatives.length * 2; i++) {
        const coop = cooperatives[i % cooperatives.length];
        
        await page.goto('/auth/login');
        await page.fill('[data-testid=email-input]', coop.testUser.email);
        await page.fill('[data-testid=password-input]', coop.testUser.password);
        await page.click('[data-testid=login-button]');
        
        // Verify correct cooperative context
        await expect(page.locator('[data-testid=cooperative-name]')).toContainText(coop.name);
        
        // Quick data verification
        await page.click('[data-testid=nav-members]');
        const memberCards = await page.locator('[data-testid=member-card]').all();
        
        // Verify all data belongs to current cooperative
        for (const card of memberCards) {
          const cooperativeId = await card.getAttribute('data-cooperative-id');
          expect(cooperativeId).toBe(coop.id);
        }
        
        // Logout for next iteration
        await page.click('[data-testid=user-menu]');
        await page.click('[data-testid=logout-button]');
      }
    });
  });

  test('should load cooperative data efficiently', async ({ page }) => {
    const coop = TEST_COOPERATIVES[0];
    
    await test.step('Measure initial load performance', async () => {
      const startTime = Date.now();
      
      await page.goto('/auth/login');
      await page.fill('[data-testid=email-input]', coop.testUser.email);
      await page.fill('[data-testid=password-input]', coop.testUser.password);
      await page.click('[data-testid=login-button]');
      
      // Wait for dashboard to fully load
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time (5 seconds)
      expect(loadTime).toBeLessThan(5000);
      
      console.log(`Dashboard loaded in ${loadTime}ms`);
    });
    
    await test.step('Measure data switching performance', async () => {
      const navigationTimes = [];
      
      const pages = ['members', 'apartments', 'finances', 'cases', 'documents'];
      
      for (const pageName of pages) {
        const startTime = Date.now();
        await page.click(`[data-testid=nav-${pageName}]`);
        await page.waitForLoadState('networkidle');
        const navTime = Date.now() - startTime;
        
        navigationTimes.push(navTime);
        
        // Each page should load quickly
        expect(navTime).toBeLessThan(3000);
      }
      
      const avgNavTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
      console.log(`Average navigation time: ${avgNavTime}ms`);
    });
  });
});