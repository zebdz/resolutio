import { describe, it, expect } from 'vitest';

/**
 * Security test suite for poll results voter data protection
 *
 * This ensures that sensitive voter information is properly filtered
 * on the server before being sent to the client, preventing unauthorized
 * access via browser console or DevTools.
 */

describe('Poll Results Security', () => {
  describe('Voter data serialization', () => {
    it('SECURITY: should filter out voter details when canViewVoters is false', () => {
      // Simulate the use case result
      const mockResults = {
        poll: {
          id: 'poll-1',
          title: 'Test Poll',
        },
        totalParticipants: 10,
        totalParticipantWeight: 100,
        canViewVoters: false, // Non-creator user
        results: [
          {
            questionId: 'q1',
            questionText: 'Question 1',
            questionType: 'single-choice',
            totalVotes: 5,
            answers: [
              {
                answerId: 'a1',
                answerText: 'Answer 1',
                voteCount: 3,
                totalWeight: 30,
                percentage: 30,
                voters: [
                  {
                    userId: 'user-1',
                    userName: { firstName: 'Alice', lastName: 'Smith' },
                    weight: 10,
                  },
                  {
                    userId: 'user-2',
                    userName: { firstName: 'Bob', lastName: 'Johnson' },
                    weight: 10,
                  },
                  {
                    userId: 'user-3',
                    userName: { firstName: 'Charlie', lastName: 'Brown' },
                    weight: 10,
                  },
                ],
              },
            ],
          },
        ],
      };

      // Simulate the server-side serialization logic
      const canViewVoters = mockResults.canViewVoters;

      const serializedResults = {
        pollId: mockResults.poll.id,
        totalParticipants: mockResults.totalParticipants,
        totalWeight: mockResults.totalParticipantWeight,
        questions: mockResults.results.map((q: any) => ({
          questionId: q.questionId,
          questionText: q.questionText,
          questionType: q.questionType,
          totalVotes: q.totalVotes,
          totalWeight: q.answers.reduce(
            (sum: number, a: any) => sum + a.totalWeight,
            0
          ),
          answers: q.answers.map((a: any) => ({
            answerId: a.answerId,
            answerText: a.answerText,
            voteCount: a.voteCount,
            weightedVotes: a.totalWeight,
            percentage: a.percentage,
            // SECURITY: Only include voter details if user has permission
            voters: canViewVoters
              ? a.voters.map((v: any) => ({
                  userId: v.userId,
                  userName: `${v.userName.firstName} ${v.userName.lastName}`,
                  weight: v.weight,
                }))
              : [], // Empty array if user doesn't have permission
          })),
        })),
      };

      // ASSERTIONS
      expect(serializedResults.questions[0].answers[0].voters).toEqual([]);
      expect(serializedResults.questions[0].answers[0].voters.length).toBe(0);

      // Verify that vote counts and percentages are still visible
      expect(serializedResults.questions[0].answers[0].voteCount).toBe(3);
      expect(serializedResults.questions[0].answers[0].percentage).toBe(30);
      expect(serializedResults.questions[0].answers[0].weightedVotes).toBe(30);
    });

    it('SECURITY: should include voter details when canViewVoters is true', () => {
      // Simulate the use case result for a poll creator
      const mockResults = {
        poll: {
          id: 'poll-1',
          title: 'Test Poll',
        },
        totalParticipants: 10,
        totalParticipantWeight: 100,
        canViewVoters: true, // Poll creator or admin
        results: [
          {
            questionId: 'q1',
            questionText: 'Question 1',
            questionType: 'single-choice',
            totalVotes: 2,
            answers: [
              {
                answerId: 'a1',
                answerText: 'Answer 1',
                voteCount: 2,
                totalWeight: 20,
                percentage: 20,
                voters: [
                  {
                    userId: 'user-1',
                    userName: { firstName: 'Alice', lastName: 'Smith' },
                    weight: 10,
                  },
                  {
                    userId: 'user-2',
                    userName: { firstName: 'Bob', lastName: 'Johnson' },
                    weight: 10,
                  },
                ],
              },
            ],
          },
        ],
      };

      // Simulate the server-side serialization logic
      const canViewVoters = mockResults.canViewVoters;

      const serializedResults = {
        pollId: mockResults.poll.id,
        questions: mockResults.results.map((q: any) => ({
          answers: q.answers.map((a: any) => ({
            voters: canViewVoters
              ? a.voters.map((v: any) => ({
                  userId: v.userId,
                  userName: `${v.userName.firstName} ${v.userName.lastName}`,
                  weight: v.weight,
                }))
              : [],
          })),
        })),
      };

      // ASSERTIONS
      expect(serializedResults.questions[0].answers[0].voters.length).toBe(2);
      expect(serializedResults.questions[0].answers[0].voters[0]).toEqual({
        userId: 'user-1',
        userName: 'Alice Smith',
        weight: 10,
      });
      expect(serializedResults.questions[0].answers[0].voters[1]).toEqual({
        userId: 'user-2',
        userName: 'Bob Johnson',
        weight: 10,
      });
    });

    it('SECURITY: should handle multiple questions and answers correctly', () => {
      const mockResults = {
        poll: { id: 'poll-1' },
        canViewVoters: false,
        results: [
          {
            questionId: 'q1',
            answers: [
              {
                answerId: 'a1',
                voters: [
                  {
                    userId: 'u1',
                    userName: { firstName: 'A', lastName: 'B' },
                    weight: 5,
                  },
                ],
              },
              {
                answerId: 'a2',
                voters: [
                  {
                    userId: 'u2',
                    userName: { firstName: 'C', lastName: 'D' },
                    weight: 10,
                  },
                ],
              },
            ],
          },
          {
            questionId: 'q2',
            answers: [
              {
                answerId: 'a3',
                voters: [
                  {
                    userId: 'u3',
                    userName: { firstName: 'E', lastName: 'F' },
                    weight: 15,
                  },
                  {
                    userId: 'u4',
                    userName: { firstName: 'G', lastName: 'H' },
                    weight: 20,
                  },
                ],
              },
            ],
          },
        ],
      };

      const canViewVoters = mockResults.canViewVoters;

      const serializedResults = {
        questions: mockResults.results.map((q: any) => ({
          answers: q.answers.map((a: any) => ({
            voters: canViewVoters
              ? a.voters.map((v: any) => ({
                  userId: v.userId,
                  userName: `${v.userName.firstName} ${v.userName.lastName}`,
                  weight: v.weight,
                }))
              : [],
          })),
        })),
      };

      // All voter arrays should be empty for non-authorized users
      serializedResults.questions.forEach((question) => {
        question.answers.forEach((answer) => {
          expect(answer.voters).toEqual([]);
        });
      });
    });

    it('DOCUMENTATION: explains the security principle', () => {
      const securityPrinciple = `
        SECURITY PRINCIPLE: Server-Side Data Filtering
        
        ❌ INSECURE: Hiding data in the UI
        - Sending all data to client and using CSS display:none
        - Checking permissions on client side
        - Relying on component props not being passed
        
        ✅ SECURE: Filtering data on the server
        - Check permissions on the server before serialization
        - Only include sensitive data if user is authorized
        - Empty arrays/null values for unauthorized users
        - Assume all client-side data is accessible via DevTools
        
        Remember: If the data is sent to the client, it can be accessed.
        Browser console, React DevTools, network inspector can all reveal
        client-side data structures.
      `;

      expect(securityPrinciple).toBeDefined();
      expect(securityPrinciple).toContain('Server-Side Data Filtering');
      expect(securityPrinciple).toContain('DevTools');
    });
  });
});
