import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const employees: string[] = ['土井', '小川', '猿田', '宮田', '齊藤', '菅原', '渡辺', '藤代', '白鳥', '川村'];
const days: Date[] = Array.from({ length: 31 }, (_, i) => new Date(Date.UTC(2024, 6, i + 1)));

const weekendOffForDoi: string[] = days.filter(day => day.getUTCDay() === 0 || day.getUTCDay() === 6).map(day => new Date(day.getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0]);

interface Shift {
  type: string;
  classname: string;
  fixed?: boolean;
}

interface Schedule {
  [key: string]: { [key: string]: Shift };
}

export async function POST(request: Request) {
  const { preferredDays = {}, offDays = {} } = await request.json();
  const initialOffDays = { ...offDays, '土井': [...(offDays['土井'] || []), ...weekendOffForDoi] };

  const schedule: Schedule = days.reduce((acc: Schedule, day: Date) => {
      const localDay = new Date(day.getTime() + (9 * 60 * 60 * 1000));
      const dayKey = localDay.toISOString().split('T')[0];
      acc[dayKey] = {};
      employees.forEach(employee => {
          acc[dayKey][employee] = { type: '', classname: '' };
      });
      return acc;
  }, {});

  employees.forEach(employee => {
      const employeePreferredDays: string[] = preferredDays[employee] || [];
      const employeeOffDays: string[] = initialOffDays[employee] || [];

      employeeOffDays.forEach(day => {
          if (schedule[day]) {
              schedule[day][employee] = { type: '公', classname: employee === '土井' ? '' : 'bg-off', fixed: true };
          }
      });

      employeePreferredDays.forEach(day => {
          if (schedule[day] && !schedule[day][employee]?.fixed) {
              schedule[day][employee] = { type: '', classname: 'bg-preferred' };
          }
      });
  });

  for (let weekStart = 0; weekStart < days.length; weekStart += 7) {
      let weekOffCount = 0;

      for (let i = 0; i < 7; i++) {
          const dayIndex = weekStart + i;
          const day = days[dayIndex];
          if (!day) break;
          const localDay = new Date(day.getTime() + (9 * 60 * 60 * 1000));
          const dayKey = localDay.toISOString().split('T')[0];

          const isWeekend = localDay.getUTCDay() === 0 || localDay.getUTCDay() === 6;
          const targetOffCount = isWeekend ? employees.length - 3 : 2;
          let assignedOffCount = Object.values(schedule[dayKey]).filter(v => v.type === '公').length;

          while (assignedOffCount < targetOffCount) {
              const availableEmployees = employees.filter(employee => schedule[dayKey][employee].type === '' && !initialOffDays[employee]?.includes(dayKey));
              if (availableEmployees.length === 0) break;
              const randomEmployee = selectRandomUser(availableEmployees);
              schedule[dayKey][randomEmployee] = { type: '公', classname: '' };
              assignedOffCount++;
              if (!isWeekend) weekOffCount++;
          }
      }
  }

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex];
      const localDay = new Date(day.getTime() + (9 * 60 * 60 * 1000));
      const dayKey = localDay.toISOString().split('T')[0];
      let availableUsers = employees.filter(employee => schedule[dayKey][employee].type !== '公');

      if (availableUsers.length > 0) {
          let earlyUser = selectRandomUser(availableUsers.filter(user => !initialOffDays[user]?.includes(dayKey)));
          if (earlyUser) {
              if (schedule[dayKey][earlyUser].type === '') {
                  schedule[dayKey][earlyUser] = { type: '早', classname: '' };
              }
              availableUsers = availableUsers.filter(user => user !== earlyUser);
          }
      }

      if (availableUsers.length > 0) {
          let cleanUser = selectRandomUser(availableUsers.filter(user => !initialOffDays[user]?.includes(dayKey)));
          if (cleanUser) {
              if (schedule[dayKey][cleanUser].type === '') {
                  schedule[dayKey][cleanUser] = { type: '★', classname: '' };
              }
              availableUsers = availableUsers.filter(user => user !== cleanUser);
          }
      }

      if (availableUsers.length > 0) {
          let inspectUser = selectRandomUser(availableUsers.filter(user => !initialOffDays[user]?.includes(dayKey)));
          if (inspectUser) {
              if (schedule[dayKey][inspectUser].type === '') {
                  schedule[dayKey][inspectUser] = { type: '検', classname: '' };
              }
          }
      }
  }

  return NextResponse.json(schedule);
}

function selectRandomUser(users: string[]): string {
    return users[Math.floor(Math.random() * users.length)];
}
